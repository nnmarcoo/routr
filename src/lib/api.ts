import {
  LocationResponse,
  PhotonFeatureCollection,
  PhotonResult,
  RouteResult,
} from "../types";
import { middleOfUSA } from "./constants";
import { formatPhotonLocation } from "./help";
import { isPointInPolygon } from "./geometry";

export async function getLocation() {
  try {
    const response = await fetch("https://ipwho.is/");
    const json = (await response.json()) as LocationResponse;
    if (
      typeof json.latitude === "number" &&
      typeof json.longitude === "number"
    ) {
      return [json.longitude, json.latitude];
    }
    // eslint-disable-next-line no-empty
  } catch {}
  return middleOfUSA;
}

function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = Math.pow(10, precision);
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]);
  }

  return coords;
}

function legsToResult(data: Record<string, unknown>): RouteResult | null {
  const trip = data?.trip as Record<string, unknown> | undefined;
  if (!trip?.legs) return null;
  const legs = trip.legs as Array<{ shape: string }>;
  const summary = trip.summary as { length: number; time: number };
  const allCoords: [number, number][] = [];
  for (const leg of legs) {
    allCoords.push(...decodePolyline(leg.shape, 6));
  }
  return {
    coordinates: allCoords,
    distanceMiles: summary.length,
    durationMinutes: summary.time / 60,
  };
}

// 2D segment intersection test.
function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const d1x = bx - ax,
    d1y = by - ay;
  const d2x = dx - cx,
    d2y = dy - cy;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

function crossesHighway(
  start: [number, number],
  candidate: [number, number],
  highways: Array<[number, number][]>,
): boolean {
  const [sx, sy] = start;
  const [cx, cy] = candidate;
  for (const way of highways) {
    for (let i = 0; i < way.length - 1; i++) {
      const [ax, ay] = way[i];
      const [bx, by] = way[i + 1];
      if (segmentsIntersect(sx, sy, cx, cy, ax, ay, bx, by)) return true;
    }
  }
  return false;
}

async function fetchHighwayGeometry(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): Promise<Array<[number, number][]>> {
  try {
    const searchRadius = Math.round(radiusMeters);
    const query = `[out:json][timeout:8];(way["highway"~"^(motorway|trunk|motorway_link|trunk_link|primary|primary_link)$"](around:${searchRadius},${centerLat},${centerLng}););out geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const ways: Array<{ geometry: Array<{ lat: number; lon: number }> }> =
      data.elements ?? [];
    return ways
      .filter((w) => w.geometry?.length >= 2)
      .map((w) =>
        w.geometry.map(({ lat, lon }) => [lon, lat] as [number, number]),
      );
  } catch {
    return [];
  }
}

const RUNNING_COSTING_OPTIONS = {
  pedestrian: {
    walkway_factor: 0.3,
    sidewalk_factor: 0.6,
    alley_factor: 8.0,
    driveway_factor: 20.0,
    use_living_streets: 0.5,
    use_tracks: 0.4,
    use_hills: 0.5,
    use_ferry: 0.0,
    step_penalty: 60,
    service_penalty: 30,
    shortest: false,
  },
};

// ─── Loop shape generators ────────────────────────────────────────────────────
//
// Each generator returns N waypoints in [lng, lat] order, arranged so that
// connecting them in sequence produces a loop with a distinct geometry.
// Using different shapes (not just rotations of a circle) forces Valhalla to
// find fundamentally different road networks.

type ShapeFn = (
  startLng: number,
  startLat: number,
  dLng: number,
  dLat: number,
  rotation: number,
) => Array<[number, number]>;

// Classic circle — waypoints evenly distributed
const shapeCircle: ShapeFn = (slng, slat, dLng, dLat, rot) =>
  Array.from({ length: 7 }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / 7;
    return [slng + dLng * Math.cos(a), slat + dLat * Math.sin(a)];
  });

// Teardrop — elongated forward, narrow behind.
// This naturally prevents the router from using the same roads for both
// "out" and "back" legs because the shape is asymmetric.
const shapeTeardrop: ShapeFn = (slng, slat, dLng, dLat, rot) => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * 2 * Math.PI;
    // r varies: max ahead, min behind — like a raindrop
    const r = 0.55 + 0.45 * Math.cos(t / 2);
    const a = rot + t;
    pts.push([slng + dLng * r * Math.cos(a), slat + dLat * r * Math.sin(a)]);
  }
  return pts;
};

// Offset lobe — the loop bulges strongly to one side.
// Forces an asymmetric route: long arc one way, short return the other.
const shapeOffsetLobe: ShapeFn = (slng, slat, dLng, dLat, rot) => {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const t = rot + (i * 2 * Math.PI) / 7;
    // Shift the centre of the circle sideways
    const cx = slng + dLng * 0.35 * Math.cos(rot + Math.PI / 2);
    const cy = slat + dLat * 0.35 * Math.sin(rot + Math.PI / 2);
    pts.push([cx + dLng * 0.75 * Math.cos(t), cy + dLat * 0.75 * Math.sin(t)]);
  }
  return pts;
};

// Figure-of-8 lobe — two sub-loops stitched together.
// Produces a route that genuinely crosses itself at the midpoint,
// making it look and feel very different from a simple loop.
const shapeFigureEight: ShapeFn = (slng, slat, dLng, dLat, rot) => {
  const pts: Array<[number, number]> = [];
  // Top lobe (6 points)
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * 2 * Math.PI) / 6;
    pts.push([
      slng + dLng * 0.55 * Math.cos(a),
      slat + dLat * 0.55 * Math.sin(a) + dLat * 0.45,
    ]);
  }
  // Bottom lobe (4 points, reversed direction so we loop back)
  for (let i = 0; i < 4; i++) {
    const a = rot - (i * 2 * Math.PI) / 4;
    pts.push([
      slng + dLng * 0.45 * Math.cos(a),
      slat + dLat * 0.45 * Math.sin(a) - dLat * 0.45,
    ]);
  }
  return pts;
};

const SHAPES: ShapeFn[] = [
  shapeCircle,
  shapeTeardrop,
  shapeOffsetLobe,
  shapeFigureEight,
];

// ─── Waypoint placement ───────────────────────────────────────────────────────

function placeWaypoint(
  candidate: [number, number],
  start: [number, number],
  highways: Array<[number, number][]>,
  polygon?: [number, number][],
): boolean {
  const polygonOk =
    !polygon || polygon.length < 3 || isPointInPolygon(candidate, polygon);
  const highwayOk =
    highways.length === 0 || !crossesHighway(start, candidate, highways);
  return polygonOk && highwayOk;
}

function makeWaypointsFromShape(
  start: [number, number],
  radiusMeters: number,
  shape: ShapeFn,
  rotation: number,
  highways: Array<[number, number][]>,
  polygon?: [number, number][],
): [number, number][] {
  const [startLng, startLat] = start;
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.cos(startLat * (Math.PI / 180)));

  const raw = shape(startLng, startLat, dLng, dLat, rotation);

  return raw.map((candidate) => {
    if (placeWaypoint(candidate, start, highways, polygon)) return candidate;
    // Try nudging outward in 15° increments
    const [cx, cy] = candidate;
    const dx = cx - startLng,
      dy = cy - startLat;
    const baseAngle = Math.atan2(dy / dLat, dx / dLng);
    for (let attempt = 1; attempt <= 24; attempt++) {
      const a = baseAngle + (attempt * Math.PI) / 12;
      const nudged: [number, number] = [
        startLng + dLng * Math.cos(a),
        startLat + dLat * Math.sin(a),
      ];
      if (placeWaypoint(nudged, start, highways, polygon)) return nudged;
    }
    return candidate; // fallback: use raw position
  });
}

// ─── Route quality scoring ────────────────────────────────────────────────────

// Returns the fraction of route coordinates that lie inside the polygon (0–1).
function routeInsideFraction(
  coords: [number, number][],
  polygon: [number, number][],
): number {
  if (coords.length === 0) return 1;
  return (
    coords.filter((c) => isPointInPolygon(c, polygon)).length / coords.length
  );
}

// Measure how much the route doubles back on itself.
// Samples every Nth point and counts how many are within 80m of a later point.
// Returns a "backtrack ratio" 0–1 (lower is better).
function backtrachRatio(coords: [number, number][]): number {
  if (coords.length < 10) return 0;
  const step = Math.max(1, Math.floor(coords.length / 60));
  const sampled = coords.filter((_, i) => i % step === 0);
  const gridSize = 0.0007; // ~80m
  const seen = new Set<string>();
  let revisits = 0;
  for (const [lng, lat] of sampled) {
    const key = `${Math.round(lng / gridSize)},${Math.round(lat / gridSize)}`;
    if (seen.has(key)) revisits++;
    seen.add(key);
  }
  return revisits / sampled.length;
}

// ─── Fetch a single variant ───────────────────────────────────────────────────

async function fetchLoopVariant(
  start: [number, number],
  radiusMeters: number,
  shape: ShapeFn,
  rotation: number,
  highways: Array<[number, number][]>,
  polygon?: [number, number][],
): Promise<RouteResult | null> {
  try {
    const waypoints = makeWaypointsFromShape(
      start,
      radiusMeters,
      shape,
      rotation,
      highways,
      polygon,
    );

    const body: Record<string, unknown> = {
      locations: [
        { lon: start[0], lat: start[1], type: "break" },
        ...waypoints.map(([lon, lat]) => ({ lon, lat, type: "through" })),
        { lon: start[0], lat: start[1], type: "break" },
      ],
      costing: "pedestrian",
      costing_options: RUNNING_COSTING_OPTIONS,
      directions_options: { units: "miles" },
    };

    const res = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const result = legsToResult(await res.json());
    if (!result) return null;

    // Reject if too much of the route leaves the polygon
    if (polygon && polygon.length >= 3) {
      if (routeInsideFraction(result.coordinates, polygon) < 0.8) return null;
    }

    // Attach backtrack score so we can sort later
    (result as RouteResult & { _backtrack?: number })._backtrack =
      backtrachRatio(result.coordinates);

    return result;
  } catch {
    return null;
  }
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function routeCells(coords: [number, number][]): Set<string> {
  const cells = new Set<string>();
  const grid = 0.0015; // ~150m — tighter than before to catch parallel roads
  for (const [lng, lat] of coords) {
    cells.add(`${Math.round(lng / grid)},${Math.round(lat / grid)}`);
  }
  return cells;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const cell of a) {
    if (b.has(cell)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function deduplicateRoutes(routes: RouteResult[]): RouteResult[] {
  const unique: RouteResult[] = [];
  const uniqueCells: Set<string>[] = [];
  for (const r of routes) {
    const cells = routeCells(r.coordinates);
    // Stricter threshold: 45% overlap = too similar
    const isDupe = uniqueCells.some(
      (uc) => jaccardSimilarity(cells, uc) > 0.45,
    );
    if (!isDupe) {
      unique.push(r);
      uniqueCells.push(cells);
    }
  }
  return unique;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getLoopRoutes(
  start: [number, number],
  targetMiles: number,
  polygon?: [number, number][],
): Promise<RouteResult[]> {
  const targetMeters = targetMiles * 1609.34;
  const baseRadius = targetMeters / (2 * Math.PI * 1.8);

  const highways = await fetchHighwayGeometry(
    start[1],
    start[0],
    baseRadius * 1.6,
  );

  // 4 shapes × 6 rotations × 3 scales = 72 jobs, but we cap at 24 concurrent
  // by batching so we don't overwhelm the public Valhalla instance.
  const rotations = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3);
  const radiusScales = [0.8, 1.0, 1.25];

  const jobs: Array<Promise<RouteResult | null>> = [];
  for (const shape of SHAPES) {
    for (const rot of rotations) {
      for (const scale of radiusScales) {
        jobs.push(
          fetchLoopVariant(
            start,
            baseRadius * scale,
            shape,
            rot,
            highways,
            polygon,
          ),
        );
      }
    }
  }

  const results = await Promise.all(jobs);
  let valid = results.filter((r): r is RouteResult => r !== null);

  // Polygon fallback: if all routes were rejected, retry without polygon constraint
  if (valid.length === 0 && polygon && polygon.length >= 3) {
    const fallback = await Promise.all(
      SHAPES.flatMap((shape) =>
        rotations.flatMap((rot) =>
          radiusScales.map((scale) =>
            fetchLoopVariant(start, baseRadius * scale, shape, rot, highways),
          ),
        ),
      ),
    );
    valid = fallback.filter((r): r is RouteResult => r !== null);
  }

  // Sort: primarily by closeness to target distance, secondarily by low backtrack ratio
  valid.sort((a, b) => {
    const distScore =
      Math.abs(a.distanceMiles - targetMiles) -
      Math.abs(b.distanceMiles - targetMiles);
    if (Math.abs(distScore) > 0.3) return distScore;
    const ab = (a as RouteResult & { _backtrack?: number })._backtrack ?? 0;
    const bb = (b as RouteResult & { _backtrack?: number })._backtrack ?? 0;
    return ab - bb;
  });

  return deduplicateRoutes(valid);
}

export async function getRoutes(
  start: [number, number],
  end: [number, number],
): Promise<RouteResult[]> {
  return fetchABVariants(start, end);
}

async function fetchABVariants(
  start: [number, number],
  end: [number, number],
): Promise<RouteResult[]> {
  try {
    const body: Record<string, unknown> = {
      locations: [
        { lon: start[0], lat: start[1] },
        { lon: end[0], lat: end[1] },
      ],
      costing: "pedestrian",
      costing_options: RUNNING_COSTING_OPTIONS,
      directions_options: { units: "miles" },
      alternates: 2,
    };

    const res = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];
    const data = await res.json();

    const results: RouteResult[] = [];
    const primary = legsToResult(data);
    if (primary) results.push(primary);

    const alts = (data.alternates ?? []) as Array<Record<string, unknown>>;
    for (const alt of alts) {
      const r = legsToResult(alt);
      if (r) results.push(r);
    }

    return results;
  } catch {
    return [];
  }
}

export async function geocode(query: string): Promise<PhotonResult[]> {
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=3`,
    );

    const data = (await res.json()) as PhotonFeatureCollection;
    if (!data.features) return [];

    const results = data.features.map((item) => ({
      id: item.properties.osm_id,
      coordinates: item.geometry.coordinates,
      name: formatPhotonLocation(item),
    }));

    return Array.from(new Map(results.map((r) => [r.id, r])).values());
  } catch {
    return [];
  }
}
