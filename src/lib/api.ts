import {
  LocationResponse,
  PhotonFeatureCollection,
  PhotonResult,
} from "../types";
import { middleOfUSA } from "./constants";

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
  // fix duplicates
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=3`,
  );
  const data = (await res.json()) as PhotonFeatureCollection;
  if (!data.features) return [];

  return data.features.map(
    (item) =>
      ({
        coordinates: item.geometry.coordinates,
        name: item.properties.name,
        city: item.properties.city,
        state: item.properties.state,
        country: item.properties.country,
        id: item.properties.osm_id,
      }) as PhotonResult,
  );
}
