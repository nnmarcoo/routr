import { LocationResponse, PhotonFeatureCollection } from "../types";
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

export async function geocode(query: string) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
  );
  const data = (await res.json()) as PhotonFeatureCollection;

  return data.features.map((item) => ({
    coordinates: item.geometry.coordinates,
    name: item.properties.name,
}));
}
