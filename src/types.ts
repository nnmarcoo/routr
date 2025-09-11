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

export interface PhotonGeometry {
  type: "Point";
  coordinates: [number, number];
}

export interface PhotonProperties {
  osm_type: string;
  osm_id: number;
  osm_key: string;
  osm_value: string;
  type: string;
  name: string;
  country: string;
  countrycode: string;
  state?: string;
  county?: string;
  city?: string;
  district?: string;
  locality?: string;
  street?: string;
  postcode?: string;
  housenumber?: string;
  extent?: [number, number, number, number];
  [key: string]: unknown;
}

export interface PhotonFeature {
  type: "Feature";
  geometry: PhotonGeometry;
  properties: PhotonProperties;
}

export interface PhotonFeatureCollection {
  type: "FeatureCollection";
  features: PhotonFeature[];
}

export interface PhotonResult {
  name: string;
  coordinates: [number, number];
}