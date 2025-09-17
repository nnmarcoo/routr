import { useMap } from "@vis.gl/react-maplibre";
import { MapMouseEvent } from "maplibre-gl";
import { useEffect } from "react";

export default function MapPolygon() {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;

    map.on("click", (e: MapMouseEvent) => {
      console.log("A click event occurred at:", e.lngLat);
    });
  }, [map]);

  if (!map) return null;

  return <></>;
}
