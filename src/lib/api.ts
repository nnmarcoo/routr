import { middleOfUSA } from "./constants";

export interface LocationResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // minLat, maxLat, minLon, maxLon
}

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
  const data = await res.json();
  if (data.length > 0)
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon )};
  return null;
}
