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

// 2D segment intersection test (no tolerance needed — pure geometry).
// Returns true if segment AB crosses segment CD.
function segmentsIntersect(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  dx: number, dy: number,
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return false; // parallel
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

// Returns true if the straight line from start to candidate crosses any
// segment in the highway geometry list.
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

// Fetch motorway/trunk geometry near a point from Overpass.
// Returns arrays of [lng, lat] coordinate chains (one per way).
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
      .map((w) => w.geometry.map(({ lat, lon }) => [lon, lat] as [number, number]));
  } catch {
    return [];
  }
}

// Pedestrian costing options tuned for running on quiet streets.
// Valhalla pedestrian has no use_roads knob, so we push all other levers:
// strongly prefer walkways/paths, penalise driveways/alleys, use living streets sparingly.
const RUNNING_COSTING_OPTIONS = {
  pedestrian: {
    walkway_factor: 0.3,       // heavily favour dedicated footpaths/trails
    sidewalk_factor: 0.6,      // prefer roads that have sidewalks
    alley_factor: 8.0,
    driveway_factor: 20.0,
    use_living_streets: 0.5,
    use_tracks: 0.4,           // welcome trails
    use_hills: 0.5,
    use_ferry: 0.0,
    step_penalty: 60,
    service_penalty: 30,       // light penalty for service roads
    shortest: false,
  },
};

// Generate waypoints on a circle. Each candidate is checked against:
// 1. The user-drawn polygon (must be inside, if provided)
// 2. Highway geometry (must not require crossing a highway from start)
function makeWaypoints(
  start: [number, number],
  radiusMeters: number,
  count: number,
  rotationOffset: number,
  highways: Array<[number, number][]>,
  polygon?: [number, number][],
): [number, number][] {
  const [startLng, startLat] = start;
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.cos(startLat * (Math.PI / 180)));

  return Array.from({ length: count }, (_, i) => {
    const baseAngle = rotationOffset + (i * 2 * Math.PI) / count;

    for (let attempt = 0; attempt < 48; attempt++) {
      const angle = baseAngle + (attempt * Math.PI) / 12;
      const candidate: [number, number] = [
        startLng + dLng * Math.cos(angle),
        startLat + dLat * Math.sin(angle),
      ];
      const polygonOk = !polygon || polygon.length < 3 || isPointInPolygon(candidate, polygon);
      const highwayOk = highways.length === 0 || !crossesHighway(start, candidate, highways);
      if (polygonOk && highwayOk) return candidate;
    }

    // Final fallback: ignore highway check (better to route than return nothing)
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = baseAngle + (attempt * Math.PI) / 12;
      const candidate: [number, number] = [
        startLng + dLng * Math.cos(angle),
        startLat + dLat * Math.sin(angle),
      ];
      if (!polygon || polygon.length < 3 || isPointInPolygon(candidate, polygon)) {
        return candidate;
      }
    }

    return [
      startLng + dLng * Math.cos(baseAngle),
      startLat + dLat * Math.sin(baseAngle),
    ];
  });
}

// Returns the fraction of route coordinates that lie inside the polygon (0–1).
function routeInsideFraction(
  coords: [number, number][],
  polygon: [number, number][],
): number {
  if (coords.length === 0) return 1;
  const inside = coords.filter((c) => isPointInPolygon(c, polygon)).length;
  return inside / coords.length;
}

async function fetchLoopVariant(
  start: [number, number],
  radiusMeters: number,
  rotationOffset: number,
  highways: Array<[number, number][]>,
  polygon?: [number, number][],
): Promise<RouteResult | null> {
  try {
    // 8 through-waypoints gives a smoother loop with fewer back-track opportunities.
    // type "through" tells Valhalla to pass through without stopping/U-turning.
    const waypoints = makeWaypoints(start, radiusMeters, 8, rotationOffset, highways, polygon);

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

    // Reject routes that spend more than 20% of their length outside the polygon.
    if (polygon && polygon.length >= 3) {
      const insideFraction = routeInsideFraction(result.coordinates, polygon);
      if (insideFraction < 0.8) return null;
    }

    return result;
  } catch {
    return null;
  }
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

// Fingerprint a route as a set of ~200m grid cells it passes through.
// Two routes are "similar" if they share >60% of cells with any existing unique route.
function routeCells(coords: [number, number][]): Set<string> {
  const cells = new Set<string>();
  const grid = 0.002; // ~200m at mid-latitudes
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
    const isDupe = uniqueCells.some((uc) => jaccardSimilarity(cells, uc) > 0.6);
    if (!isDupe) {
      unique.push(r);
      uniqueCells.push(cells);
    }
  }
  return unique;
}

export async function getLoopRoutes(
  start: [number, number],
  targetMiles: number,
  polygon?: [number, number][],
): Promise<RouteResult[]> {
  const targetMeters = targetMiles * 1609.34;
  const baseRadius = targetMeters / (2 * Math.PI * 1.8);

  // Fetch highway geometry once and reuse for all waypoint generation.
  // Run this in parallel with nothing else — it gates waypoint placement only,
  // not the Valhalla requests themselves (those start immediately after).
  const highways = await fetchHighwayGeometry(start[1], start[0], baseRadius * 1.5);

  // 8 rotations × 2 scales = 16 parallel variants, covering all compass directions
  // with two different loop sizes. More rotations = more geometric diversity.
  const rotations = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  const radiusScales = [0.9, 1.15];

  const jobs: Array<Promise<RouteResult | null>> = [];
  for (const rot of rotations) {
    for (const scale of radiusScales) {
      jobs.push(fetchLoopVariant(start, baseRadius * scale, rot, highways, polygon));
    }
  }

  const results = await Promise.all(jobs);
  let valid = results.filter((r): r is RouteResult => r !== null);

  // If the polygon filter rejected everything, retry without it so the user
  // still sees routes (polygon may be too small for the requested distance).
  if (valid.length === 0 && polygon && polygon.length >= 3) {
    const fallbackJobs: Array<Promise<RouteResult | null>> = [];
    for (const rot of rotations) {
      for (const scale of radiusScales) {
        fallbackJobs.push(fetchLoopVariant(start, baseRadius * scale, rot, highways));
      }
    }
    const fallback = await Promise.all(fallbackJobs);
    valid = fallback.filter((r): r is RouteResult => r !== null);
  }

  valid.sort(
    (a, b) =>
      Math.abs(a.distanceMiles - targetMiles) -
      Math.abs(b.distanceMiles - targetMiles),
  );

  return deduplicateRoutes(valid);
}

export async function getRoutes(
  start: [number, number],
  end: [number, number],
): Promise<RouteResult[]> {
  return fetchABVariants(start, end);
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
