import { PhotonFeature } from "../types";

export function formatPhotonLocation(feature: PhotonFeature): string {
  const props = feature.properties;

  // Try to build the most specific address possible
  const parts: string[] = [];

  if (props.housenumber) parts.push(props.housenumber);
  if (props.street) parts.push(props.street);

  // If no street info, fallback to locality/district/city
  if (!props.street && props.locality) parts.push(props.locality);
  if (!props.street && !props.locality && props.district)
    parts.push(props.district);

  if (props.city) parts.push(props.city);
  if (props.county && !props.city) parts.push(props.county); // only if city is missing
  if (props.state) parts.push(props.state);

  if (props.country) parts.push(props.country);

  // Join parts cleanly
  return parts.join(", ") || props.name || "Unknown location";
}
