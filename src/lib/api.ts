import { middleOfUSA } from "./constants";

export interface LocationResponse {
  About_Us: string;
  ip: string;
  success: boolean;
  type: string;
  continent: string;
  continent_code: string;
  country: string;
  country_code: string;
  region: string;
  region_code: string;
  city: string;
  latitude: number;
  longitude: number;
  is_eu: boolean;
  postal: string;
  calling_code: string;
  capital: string;
  borders: string;
  flag: {
    img: string;
    emoji: string;
    emoji_unicode: string;
  };
  connection: {
    asn: number;
    org: string;
    isp: string;
    domain: string;
  };
  timezone: {
    id: string;
    abbr: string;
    is_dst: boolean;
    offset: number;
    utc: string;
    current_time: string;
  };
}


export async function getLocation() {
  try {
    const response = await fetch("https://ipwho.is/");
    const json = (await response.json() as LocationResponse);
    if (typeof json.latitude === "number" && typeof json.longitude === "number") {
      return [json.longitude, json.latitude];
    }
  // eslint-disable-next-line no-empty
  } catch {}
  return middleOfUSA;
}