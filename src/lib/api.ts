import {
  LocationResponse,
  PhotonFeatureCollection,
  PhotonResult,
} from "../types";
import { middleOfUSA } from "./constants";
import { formatPhotonLocation } from "./help";

export async function getLocation() {
  try {
    const res = await fetch("http://ip-api.com/json/");
    const json = (await res.json()) as LocationResponse;
    if (typeof json.lat === "number" && typeof json.lon === "number") {
      return [json.lon, json.lat];
    }
    // eslint-disable-next-line no-empty
  } catch {}
  return middleOfUSA;
}

export async function geocode(query: string): Promise<PhotonResult[]> {
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
}
