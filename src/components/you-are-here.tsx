import { useEffect } from "react";
import { middleOfUSA } from "../lib/constants";
import { useMap } from "@vis.gl/react-maplibre";
import { getLocation } from "../lib/api";

export default function YouAreHere() {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;
    (async () => {
      const location = await getLocation();
      if (location !== middleOfUSA) map.flyTo({ center: location, zoom: 8 });
    })();
  }, [map]);

  if (!map) return null;

  return <></>;
}
