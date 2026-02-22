import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { RouteResult } from "../types";
import type { Feature, LineString } from "geojson";

interface RouteLayerProps {
  route: RouteResult | null;
}

const SRC = "route-line";
const LYR_CASING = "route-line-casing";
const LYR_LINE = "route-line-layer";
const LYR_ARROWS = "route-line-arrows";
const ARROW_IMAGE = "route-arrow";

function makeArrowImage(size: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const m = size / 2;
  const tip = size * 0.82;
  const arm = size * 0.28;
  ctx.beginPath();
  ctx.moveTo(tip, m);
  ctx.lineTo(m - size * 0.05, m - arm);
  ctx.lineTo(m - size * 0.05, m + arm);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

export default function RouteLayer({ route }: RouteLayerProps) {
  const mapRef = useMap();
  const map = mapRef?.current?.getMap();
  const initializedRef = useRef(false);

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
      if (!map.hasImage(ARROW_IMAGE)) {
        map.addImage(ARROW_IMAGE, makeArrowImage(32), { pixelRatio: 2 });
      }

      if (map.getSource(SRC)) {
        (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        initializedRef.current = false;
      }

      if (!initializedRef.current) {
        if (!map.getSource(SRC)) {
          map.addSource(SRC, {
            type: "geojson",
            data: geojson,
            lineMetrics: true,
          });
        }

        if (!map.getLayer(LYR_CASING)) {
          map.addLayer({
            id: LYR_CASING,
            type: "line",
            source: SRC,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#1e40af",
              "line-width": 7,
              "line-opacity": 0.25,
            },
          });
        }

        if (!map.getLayer(LYR_LINE)) {
          map.addLayer({
            id: LYR_LINE,
            type: "line",
            source: SRC,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-gradient": [
                "interpolate",
                ["linear"],
                ["line-progress"],
                0,
                "#93c5fd",
                0.5,
                "#3b82f6",
                1,
                "#1e3a8a",
              ],
              "line-width": 4,
            },
          });
        }

        if (!map.getLayer(LYR_ARROWS)) {
          map.addLayer({
            id: LYR_ARROWS,
            type: "symbol",
            source: SRC,
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 100,
              "icon-image": ARROW_IMAGE,
              "icon-size": 0.55,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });
        }

        initializedRef.current = true;
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      const onLoad = () => {
        apply();
        map.off("styledata", onLoad);
      };
      map.on("styledata", onLoad);
    }
  }, [map, route]);

  return null;
}
