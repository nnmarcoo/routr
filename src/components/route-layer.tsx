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

// Draw a right-pointing chevron arrow onto a canvas for use as a MapLibre sprite.
function makeArrowImage(size: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  const m = size / 2;
  const tip = size * 0.85;
  const tail = size * 0.15;
  const arm = size * 0.3;

  ctx.beginPath();
  ctx.moveTo(tip, m);          // arrowhead tip (right)
  ctx.lineTo(m, m - arm);      // upper arm
  ctx.lineTo(m, m + arm);      // lower arm
  ctx.closePath();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();

  // Thin stem line
  ctx.beginPath();
  ctx.moveTo(tail, m);
  ctx.lineTo(m, m);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  ctx.stroke();

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
      // Register arrow image once
      if (!map.hasImage(ARROW_IMAGE)) {
        const img = makeArrowImage(32);
        map.addImage(ARROW_IMAGE, img, { pixelRatio: 2 });
      }

      if (map.getSource(SRC)) {
        (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        initializedRef.current = false;
      }

      if (!initializedRef.current) {
        if (!map.getSource(SRC)) {
          map.addSource(SRC, { type: "geojson", data: geojson });
        }

        if (!map.getLayer(LYR_CASING)) {
          map.addLayer({
            id: LYR_CASING,
            type: "line",
            source: SRC,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#1d4ed8",
              "line-width": 8,
              "line-opacity": 0.5,
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
              "line-color": "#3b82f6",
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
              "symbol-spacing": 80,       // pixels between arrows
              "icon-image": ARROW_IMAGE,
              "icon-size": 0.5,
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
      const onLoad = () => { apply(); map.off("styledata", onLoad); };
      map.on("styledata", onLoad);
    }
  }, [map, route]);

  return null;
}
