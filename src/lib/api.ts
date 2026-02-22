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

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
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

// ─── OSM walkable graph types ─────────────────────────────────────────────────

interface GraphNode {
  lat: number;
  lon: number;
  neighbors: Array<{ nodeId: number; distMeters: number }>;
}
type WalkGraph = Map<number, GraphNode>;
interface DfsCandidate {
  nodeIds: number[];
  totalDist: number;
}

function computeOverpassRadius(targetMeters: number): number {
  // A loop of circumference C roughly fits in a circle of radius C/(2π).
  // Multiply by 1.8 to give the DFS room to explore diverse directions and
  // find routes that aren't just a tight circle around the start.
  return Math.max(800, Math.min(25_000, Math.round((targetMeters / (2 * Math.PI)) * 1.8)));
}

async function fetchWalkableGraph(
  centerLat: number,
  centerLon: number,
  radiusMeters: number,
): Promise<WalkGraph> {
  try {
    const r = Math.round(radiusMeters);
    // "out geom" embeds full node geometry directly into each way element,
    // giving us every shape point at full OSM coordinate precision.
    const query = `[out:json][timeout:30];(way["highway"~"^(footway|path|pedestrian|residential|living_street|cycleway|track|service|unclassified|tertiary|secondary)$"]["access"!="private"](around:${r},${centerLat},${centerLon}););out geom;`;
    const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
      method: "POST",
      body: query,
    });
    if (!res.ok) return new Map();

    const data = await res.json();
    const elements: Array<{
      type: string;
      id: number;
      geometry?: Array<{ lat: number; lon: number }>;
    }> = data.elements ?? [];

    // OSM stores coordinates at 7 decimal places (≈1cm precision).
    // Two geometry points with identical lat/lon strings are the *same OSM node*,
    // so we can detect intersections in O(n) using a coordinate → canonical-ID map,
    // without any distance calculations.
    const coordKey = (lat: number, lon: number) =>
      `${lat.toFixed(7)},${lon.toFixed(7)}`;

    // Pass 1: assign every unique coordinate a stable canonical node ID.
    let nextId = 1;
    const coordToId = new Map<string, number>();
    const graph: WalkGraph = new Map();

    const getOrCreate = (lat: number, lon: number): number => {
      const key = coordKey(lat, lon);
      let id = coordToId.get(key);
      if (id === undefined) {
        id = nextId++;
        coordToId.set(key, id);
        graph.set(id, { lat, lon, neighbors: [] });
      }
      return id;
    };

    // Pass 2: build edges. Because getOrCreate deduplicates by coordinate,
    // two ways sharing a node automatically get the same ID — intersections
    // are connected for free, including T-junctions and midpoint crossings.
    const addEdge = (aId: number, bId: number, d: number) => {
      const a = graph.get(aId)!;
      const b = graph.get(bId)!;
      if (!a.neighbors.some((n) => n.nodeId === bId))
        a.neighbors.push({ nodeId: bId, distMeters: d });
      if (!b.neighbors.some((n) => n.nodeId === aId))
        b.neighbors.push({ nodeId: aId, distMeters: d });
    };

    for (const el of elements) {
      if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
      const pts = el.geometry;
      let prevId = getOrCreate(pts[0].lat, pts[0].lon);
      for (let i = 1; i < pts.length; i++) {
        const curId = getOrCreate(pts[i].lat, pts[i].lon);
        const d = haversineMeters(
          pts[i - 1].lat,
          pts[i - 1].lon,
          pts[i].lat,
          pts[i].lon,
        );
        addEdge(prevId, curId, d);
        prevId = curId;
      }
    }

    return graph;
  } catch {
    return new Map();
  }
}

function snapToNearestNode(
  graph: WalkGraph,
  lng: number,
  lat: number,
): number | null {
  let bestId: number | null = null;
  let bestDist = Infinity;
  for (const [id, node] of graph) {
    const d = haversineMeters(lat, lng, node.lat, node.lon);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}

// ─── DFS loop finder ─────────────────────────────────────────────────────────
//
// Uses parent-pointer reconstruction instead of copying path arrays on every
// push. Each stack frame stores only (nodeId, parentFrameIndex, dist,
// visitedEdges, cellCounts) — no O(n) copies, no GC pressure.
//
// Cell-count map (O(1) lookup) replaces the O(path.length) scan.
//
// Each DFS run now collects up to MAX_RESULTS_PER_RUN valid closures instead
// of stopping at the first one — giving much more variety per directional pass.
// At intersection nodes (degree ≥ 3) neighbors are shuffled so the DFS
// branches in structurally different directions.

function findIntersectionNodes(graph: WalkGraph): Set<number> {
  const intersections = new Set<number>();
  for (const [id, node] of graph) {
    if (node.neighbors.length >= 3) intersections.add(id);
  }
  return intersections;
}

interface DfsFrame {
  nodeId: number;
  parentIdx: number; // index into frames[], -1 for root
  depth: number;     // distance from root in hops
  dist: number;
  visitedEdges: Set<string>;
  cellCounts: Map<string, number>; // ~500m grid cell → visit count
}

function reconstructPath(frames: DfsFrame[], frameIdx: number): number[] {
  const path: number[] = [];
  let idx = frameIdx;
  while (idx !== -1) {
    path.push(frames[idx].nodeId);
    idx = frames[idx].parentIdx;
  }
  path.reverse();
  return path;
}

function cellKey(lon: number, lat: number): string {
  // ~500m grid — coarse enough that the DFS can leave the start area
  // before hitting the revisit cap, while still preventing tight loops.
  return `${Math.round(lon / 0.005)},${Math.round(lat / 0.005)}`;
}

function runSingleDfs(
  graph: WalkGraph,
  startId: number,
  startNode: GraphNode,
  targetMeters: number,
  minDist: number,
  maxDist: number,
  polygon: [number, number][] | undefined,
  globalUsedEdges: Set<string>,
  runIndex: number,
  numCandidates: number,
  intersectionNodes: Set<number>,
): DfsCandidate[] {
  // Depth limit: average OSM segment in dense areas is ~10-20m, so a 5-mile
  // (8km) route needs at most ~800 segments. Allow 20% headroom.
  const MAX_DEPTH = Math.min(1000, Math.ceil((targetMeters / 15) * 1.2));
  const MAX_NODES_EXPLORED = 200_000;
  // Collect up to this many distinct closures per directional pass
  const MAX_RESULTS_PER_RUN = 4;
  const runAngle = (runIndex / numCandidates) * 2 * Math.PI;

  const frames: DfsFrame[] = [];
  const stack: number[] = [];

  const rootFrame: DfsFrame = {
    nodeId: startId,
    parentIdx: -1,
    depth: 0,
    dist: 0,
    visitedEdges: new Set<string>(),
    cellCounts: new Map<string, number>(),
  };
  frames.push(rootFrame);
  stack.push(0);

  let nodesExplored = 0;
  const results: DfsCandidate[] = [];

  while (
    stack.length > 0 &&
    nodesExplored < MAX_NODES_EXPLORED &&
    results.length < MAX_RESULTS_PER_RUN
  ) {
    nodesExplored++;
    const frameIdx = stack.pop()!;
    const frame = frames[frameIdx];
    const { nodeId, depth, dist, visitedEdges, cellCounts } = frame;
    const node = graph.get(nodeId);
    if (!node) continue;

    if (depth > MAX_DEPTH) continue;

    // Check if we can close the loop — only after we've gone far enough
    if (depth > 4 && dist >= minDist && dist <= maxDist) {
      const closeDist = haversineMeters(
        node.lat, node.lon, startNode.lat, startNode.lon,
      );
      if (closeDist < targetMeters * 0.08) {
        // Valid closure — record it and keep exploring for more
        const nodeIds = [...reconstructPath(frames, frameIdx), startId];
        results.push({ nodeIds, totalDist: dist });
        // Don't continue expanding from this frame — the loop is closed
        continue;
      }
    }

    if (dist > maxDist) continue;

    const isIntersection = intersectionNodes.has(nodeId);

    // At intersections: shuffle neighbors so the DFS branches in different
    // directions on each call, producing structurally distinct routes.
    // On plain segments: sort by angle-alignment so we trend toward runAngle.
    let neighbors = [...node.neighbors];
    if (isIntersection) {
      // Fisher-Yates shuffle — O(n), deterministic per runIndex so reruns
      // with the same seed explore the same order (reproducible enough)
      for (let i = neighbors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.abs(Math.sin(runIndex * 13 + i * 7 + depth)) * (i + 1));
        [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
      }
    } else {
      neighbors.sort((a, b) => {
        const aUsed = globalUsedEdges.has(`${nodeId}-${a.nodeId}`) ? 1 : 0;
        const bUsed = globalUsedEdges.has(`${nodeId}-${b.nodeId}`) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
        const aN = graph.get(a.nodeId);
        const bN = graph.get(b.nodeId);
        if (!aN || !bN) return 0;
        const aAngle = Math.atan2(aN.lat - node.lat, aN.lon - node.lon);
        const bAngle = Math.atan2(bN.lat - node.lat, bN.lon - node.lon);
        const aDiff = Math.abs(((aAngle - runAngle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        const bDiff = Math.abs(((bAngle - runAngle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        return aDiff - bDiff;
      });
    }

    // Push children in reverse so the first-preferred is explored first (LIFO)
    for (let i = neighbors.length - 1; i >= 0; i--) {
      const { nodeId: nextId, distMeters } = neighbors[i];
      const edgeKey = `${nodeId}-${nextId}`;
      if (visitedEdges.has(edgeKey)) continue;

      const nextNode = graph.get(nextId);
      if (!nextNode) continue;

      if (polygon && polygon.length >= 3) {
        if (!isPointInPolygon([nextNode.lon, nextNode.lat], polygon)) continue;
      }

      const newDist = dist + distMeters;

      // Admissibility pruning: even if we beeline back, would we overshoot?
      const closingDist = haversineMeters(
        nextNode.lat, nextNode.lon, startNode.lat, startNode.lon,
      );
      if (newDist + closingDist > maxDist * 1.15) continue;

      // Cell backtrack limit: O(1) via inherited count map
      const ck = cellKey(nextNode.lon, nextNode.lat);
      if ((cellCounts.get(ck) ?? 0) >= 3) continue;

      // Build child frame — copy only the small sets/maps (not path arrays)
      const newVisited = new Set(visitedEdges);
      newVisited.add(edgeKey);
      const newCells = new Map(cellCounts);
      newCells.set(ck, (newCells.get(ck) ?? 0) + 1);

      const childFrame: DfsFrame = {
        nodeId: nextId,
        parentIdx: frameIdx,
        depth: depth + 1,
        dist: newDist,
        visitedEdges: newVisited,
        cellCounts: newCells,
      };
      frames.push(childFrame);
      stack.push(frames.length - 1);
    }
  }

  return results;
}

async function dfsLoopCandidates(
  graph: WalkGraph,
  startId: number,
  targetMeters: number,
  polygon: [number, number][] | undefined,
  numRuns: number,
): Promise<DfsCandidate[]> {
  const minDist = targetMeters * 0.75;
  const maxDist = targetMeters * 1.35;
  const startNode = graph.get(startId);
  if (!startNode) return [];

  const intersectionNodes = findIntersectionNodes(graph);
  const results: DfsCandidate[] = [];
  const globalUsedEdges = new Set<string>();

  for (let run = 0; run < numRuns; run++) {
    const candidates = runSingleDfs(
      graph, startId, startNode, targetMeters,
      minDist, maxDist, polygon, globalUsedEdges, run, numRuns,
      intersectionNodes,
    );
    for (const candidate of candidates) {
      results.push(candidate);
      // Mark this candidate's edges as used so later runs explore fresh roads
      for (let i = 0; i < candidate.nodeIds.length - 1; i++) {
        globalUsedEdges.add(`${candidate.nodeIds[i]}-${candidate.nodeIds[i + 1]}`);
        globalUsedEdges.add(`${candidate.nodeIds[i + 1]}-${candidate.nodeIds[i]}`);
      }
    }
  }

  return results;
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

// ─── DFS candidate → Valhalla validation ─────────────────────────────────────

function downsamplePath(
  nodeIds: number[],
  graph: WalkGraph,
  targetCount = 10,
): Array<[number, number]> {
  const resolve = (id: number): [number, number] | null => {
    const n = graph.get(id);
    return n ? [n.lon, n.lat] : null;
  };
  if (nodeIds.length <= targetCount) {
    return nodeIds.map(resolve).filter((c): c is [number, number] => c !== null);
  }
  const sampled: Array<[number, number]> = [];
  for (let i = 0; i < targetCount; i++) {
    const idx = Math.round((i * (nodeIds.length - 1)) / (targetCount - 1));
    const coord = resolve(nodeIds[Math.min(idx, nodeIds.length - 1)]);
    if (coord) sampled.push(coord);
  }
  return sampled;
}

async function fetchLoopFromCandidate(
  start: [number, number],
  candidate: DfsCandidate,
  graph: WalkGraph,
  polygon?: [number, number][],
): Promise<RouteResult | null> {
  try {
    const throughCoords = downsamplePath(candidate.nodeIds, graph, 10);

    const body: Record<string, unknown> = {
      locations: [
        { lon: start[0], lat: start[1], type: "break" },
        ...throughCoords.map(([lon, lat]) => ({ lon, lat, type: "through" })),
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

    if (polygon && polygon.length >= 3) {
      if (routeInsideFraction(result.coordinates, polygon) < 0.8) return null;
    }

    (result as RouteResult & { _backtrack?: number })._backtrack =
      backtrachRatio(result.coordinates);

    return result;
  } catch {
    return null;
  }
}

async function geometricFallback(
  start: [number, number],
  targetMeters: number,
  highways: Array<[number, number][]>,
  polygon?: [number, number][],
): Promise<RouteResult[]> {
  const baseRadius = targetMeters / (2 * Math.PI * 1.8);
  const rotations = Array.from({ length: 4 }, (_, i) => (i * Math.PI * 2) / 4);
  const jobs: Array<Promise<RouteResult | null>> = [];
  for (const shape of SHAPES) {
    for (const rot of rotations) {
      jobs.push(
        fetchLoopVariant(start, baseRadius, shape, rot, highways, polygon),
      );
    }
  }
  const results = await Promise.all(jobs);
  return results.filter((r): r is RouteResult => r !== null);
}

// ─── Main export ──────────────────────────────────────────────────────────────

// Validates candidates concurrently and streams each result via onProgress
// as soon as it arrives. Uses a mutex-style accumulator to avoid race
// conditions when multiple fetches resolve at nearly the same time.
async function validateCandidatesStreaming(
  candidates: DfsCandidate[],
  start: [number, number],
  graph: WalkGraph,
  polygon: [number, number][] | undefined,
  onProgress: ((route: RouteResult) => void) | undefined,
): Promise<RouteResult[]> {
  const accumulated: RouteResult[] = [];
  await Promise.all(
    candidates.map(async (c) => {
      const result = await fetchLoopFromCandidate(start, c, graph, polygon);
      if (result) {
        // Push first, then notify — accumulated is append-only so no race
        // between concurrent async callbacks (JS is single-threaded; push
        // completes atomically before the next microtask can run).
        accumulated.push(result);
        onProgress?.(result);
      }
    }),
  );
  return accumulated;
}

export async function getLoopRoutes(
  start: [number, number],
  targetMiles: number,
  polygon?: [number, number][],
  onProgress?: (route: RouteResult) => void,
): Promise<RouteResult[]> {
  const targetMeters = targetMiles * 1609.34;
  const overpassRadius = computeOverpassRadius(targetMeters);
  const [startLon, startLat] = start;

  // Fetch highway geometry (for fallback) and walkable graph in parallel
  const [highways, graph] = await Promise.all([
    fetchHighwayGeometry(startLat, startLon, overpassRadius * 1.2),
    fetchWalkableGraph(startLat, startLon, overpassRadius),
  ]);

  let valid: RouteResult[] = [];

  const startNodeId = snapToNearestNode(graph, startLon, startLat);

  if (startNodeId !== null && graph.size > 50) {
    const candidates = await dfsLoopCandidates(
      graph,
      startNodeId,
      targetMeters,
      polygon,
      12,
    );

    if (candidates.length > 0) {
      valid = await validateCandidatesStreaming(
        candidates,
        start,
        graph,
        polygon,
        onProgress,
      );
    }
  }

  // Fallback: geometric waypoint sweep (4 shapes × 4 rotations = 16 calls)
  // when DFS produces fewer than 4 routable candidates.
  if (valid.length < 4) {
    const fallbackRoutes = await geometricFallback(
      start,
      targetMeters,
      highways,
      polygon,
    );
    valid = [...valid, ...fallbackRoutes];

    // If polygon caused everything to be rejected, retry without it
    if (valid.length === 0 && polygon && polygon.length >= 3) {
      const noPolyFallback = await geometricFallback(
        start,
        targetMeters,
        highways,
      );
      valid = noPolyFallback;
    }
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

  return deduplicateRoutes(valid).slice(0, 8);
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
