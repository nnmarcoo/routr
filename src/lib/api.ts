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

export async function getLoopRoute(
  start: [number, number],
  targetMiles: number,
  polygon?: [number, number][],
): Promise<RouteResult | null> {
  try {
    const [startLng, startLat] = start;
    const targetMeters = targetMiles * 1609.34;
    // road-factor 1.4: actual road distance is ~40% longer than straight-line perimeter
    const radius = targetMeters / (2 * Math.PI * 1.4);
    const dLat = radius / 111320;
    const dLng = radius / (111320 * Math.cos(startLat * (Math.PI / 180)));

    // 3 waypoints at 90°, 210°, 330° (evenly spaced, first points north)
    const baseAngles = [
      Math.PI / 2,
      Math.PI / 2 + (2 * Math.PI) / 3,
      Math.PI / 2 + (4 * Math.PI) / 3,
    ];

    const waypoints: [number, number][] = baseAngles.map((baseAngle) => {
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = baseAngle + (attempt * Math.PI) / 12; // rotate 15° per attempt
        const candidate: [number, number] = [
          startLng + dLng * Math.cos(angle),
          startLat + dLat * Math.sin(angle),
        ];
        if (!polygon || polygon.length < 3 || isPointInPolygon(candidate, polygon)) {
          return candidate;
        }
      }
      // fallback: use base angle even if outside polygon
      return [
        startLng + dLng * Math.cos(baseAngle),
        startLat + dLat * Math.sin(baseAngle),
      ];
    });

    const body = {
      locations: [
        { lon: start[0], lat: start[1] },
        ...waypoints.map(([lon, lat]) => ({ lon, lat })),
        { lon: start[0], lat: start[1] },
      ],
      costing: "pedestrian",
      directions_options: { units: "miles" },
    };

    const res = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.trip?.legs) return null;

    // Valhalla returns one leg per segment — concatenate all decoded shapes
    const allCoords: [number, number][] = [];
    for (const leg of data.trip.legs) {
      allCoords.push(...decodePolyline(leg.shape, 6));
    }

    const distanceMiles: number = data.trip.summary.length;
    const durationMinutes: number = data.trip.summary.time / 60;

    return { coordinates: allCoords, distanceMiles, durationMinutes };
  } catch {
    return null;
  }
}

export async function getRoute(
  start: [number, number],
  end: [number, number],
): Promise<RouteResult | null> {
  try {
    const body = {
      locations: [
        { lon: start[0], lat: start[1] },
        { lon: end[0], lat: end[1] },
      ],
      costing: "pedestrian",
      directions_options: { units: "miles" },
    };

    const res = await fetch("https://valhalla1.openstreetmap.de/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const leg = data?.trip?.legs?.[0];
    if (!leg) return null;

    const coordinates = decodePolyline(leg.shape, 6);
    const distanceMiles: number = data.trip.summary.length;
    const durationMinutes: number = data.trip.summary.time / 60;

    return { coordinates, distanceMiles, durationMinutes };
  } catch {
    return null;
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
