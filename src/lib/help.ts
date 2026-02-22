import { PhotonFeature } from "../types";

export function formatPhotonLocation(feature: PhotonFeature): string {
  const props = feature.properties;
  const parts: string[] = [];

  if (props.housenumber) parts.push(props.housenumber);
  if (props.street) parts.push(props.street);

  if (!props.street && props.locality) parts.push(props.locality);
  if (!props.street && !props.locality && props.district)
    parts.push(props.district);

  if (props.city) parts.push(props.city);
  if (props.county && !props.city) parts.push(props.county);
  if (props.state) parts.push(props.state);
  if (props.country) parts.push(props.country);

  return parts.join(", ") || props.name || "Unknown location";
}
