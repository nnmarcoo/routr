import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { Marker } from "maplibre-gl";
import { RouteResult } from "../types";

interface RouteTimelineProps {
  route: RouteResult;
}

// Accumulate per-segment distances so we can map a fraction to a coordinate.
function buildDistanceTable(coords: [number, number][]): {
  cumulative: number[];
  total: number;
} {
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = coords[i - 1];
    const [bx, by] = coords[i];
    const dx = (bx - ax) * Math.cos((ay + by) * 0.5 * (Math.PI / 180)) * 111320;
    const dy = (by - ay) * 111320;
    cumulative.push(cumulative[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return { cumulative, total: cumulative[cumulative.length - 1] };
}

// Interpolate position along the route at fraction t ∈ [0, 1].
function positionAtFraction(
  coords: [number, number][],
  cumulative: number[],
  total: number,
  t: number,
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  const target = t * total;
  let lo = 0,
    hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= target) lo = mid;
    else hi = mid;
  }
  const seg = cumulative[hi] - cumulative[lo];
  const frac = seg === 0 ? 0 : (target - cumulative[lo]) / seg;
  const [ax, ay] = coords[lo];
  const [bx, by] = coords[hi];
  return [ax + (bx - ax) * frac, ay + (by - ay) * frac];
}

// Create a small circular marker element.
function makeMarkerEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 14px; height: 14px; border-radius: 50%;
    background: #2563eb; border: 2.5px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    pointer-events: none;
  `;
  return el;
}

export default function RouteTimeline({ route }: RouteTimelineProps) {
  const { current: mapApi } = useMap();
  const [fraction, setFraction] = useState(0);
  const markerRef = useRef<Marker | null>(null);
  const tableRef = useRef<{ cumulative: number[]; total: number } | null>(null);

  // Build distance table whenever route changes.
  useEffect(() => {
    tableRef.current = buildDistanceTable(route.coordinates);
    setFraction(0);
  }, [route]);

  // Manage the marker lifecycle.
  useEffect(() => {
    if (!mapApi) return;
    const map = mapApi.getMap();
    const el = makeMarkerEl();
    const marker = new Marker({ element: el, anchor: "center" });
    if (route.coordinates.length > 0) {
      marker.setLngLat(route.coordinates[0]).addTo(map);
    }
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [mapApi, route]);

  // Move marker when fraction changes.
  useEffect(() => {
    if (
      !markerRef.current ||
      !tableRef.current ||
      route.coordinates.length === 0
    )
      return;
    const { cumulative, total } = tableRef.current;
    const pos = positionAtFraction(
      route.coordinates,
      cumulative,
      total,
      fraction,
    );
    markerRef.current.setLngLat(pos);
  }, [fraction, route]);

  const distanceCovered = fraction * route.distanceMiles;
  const minutesCovered = fraction * route.durationMinutes;
  const minsInt = Math.round(minutesCovered);
  const hrs = Math.floor(minsInt / 60);
  const rem = minsInt % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${rem}m` : `${minsInt}m`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Progress bar / scrubber */}
      <div
        style={{
          position: "relative",
          height: 28,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Track */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: "#e2e8f0",
          }}
        />
        {/* Fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            height: 4,
            borderRadius: 2,
            background: "#3b82f6",
            width: `${fraction * 100}%`,
            transition: "width 0.05s",
          }}
        />
        {/* Range input over top */}
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(fraction * 1000)}
          onChange={(e) => setFraction(Number(e.target.value) / 1000)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            opacity: 0,
            cursor: "pointer",
            margin: 0,
            height: 28,
          }}
        />
        {/* Thumb indicator */}
        <div
          style={{
            position: "absolute",
            left: `calc(${fraction * 100}% - 7px)`,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#3b82f6",
            border: "2px solid #fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            pointerEvents: "none",
            transition: "left 0.05s",
          }}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {distanceCovered.toFixed(2)}{" "}
          <span style={{ color: "#94a3b8" }}>
            / {route.distanceMiles.toFixed(2)} mi
          </span>
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {timeStr} <span style={{ color: "#94a3b8" }}>elapsed</span>
        </span>
      </div>
    </div>
  );
}
