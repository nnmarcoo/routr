import { useEffect } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { RouteResult } from "../types";
import type { Feature, LineString } from "geojson";

interface RouteLayerProps {
  route: RouteResult | null;
}

const SOURCE_ID = "route-line";
const LAYER_ID = "route-line-layer";
const CASING_ID = "route-line-casing";

export default function RouteLayer({ route }: RouteLayerProps) {
  const mapRef = useMap();
  const map = mapRef?.current?.getMap();

  useEffect(() => {
    if (!map) return;

    const geojson: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: route ? route.coordinates : [],
      },
    };

    const apply = () => {
      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
        map.addLayer({
          id: CASING_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#1d4ed8", "line-width": 8, "line-opacity": 0.6 },
        });
        map.addLayer({
          id: LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#3b82f6", "line-width": 4 },
        });
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      const onLoad = () => { apply(); map.off("styledata", onLoad); };
      map.on("styledata", onLoad);
    }
  }, [map, route]);

  return null;
}
