import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { MapMouseEvent } from "maplibre-gl";
import type {
  Feature,
  Polygon,
  LineString,
  FeatureCollection,
  Point,
} from "geojson";

const SRC_POLYGON = "polygon-region";
const SRC_VERTICES = "polygon-vertices";
const SRC_PREVIEW = "polygon-preview-line";
const LYR_FILL = "polygon-region-fill";
const LYR_OUTLINE = "polygon-region-outline";
const LYR_VERTICES = "polygon-vertex-circles";
const LYR_PREVIEW = "polygon-preview";

interface ToolSelectProps {
  polygonCoords: [number, number][];
  polygonClosed: boolean;
  setPolygonCoords: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setPolygonClosed: React.Dispatch<React.SetStateAction<boolean>>;
}

function ToolBtn({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 7,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        background: active ? "#3b82f6" : "#f1f5f9",
        color: disabled ? "#cbd5e1" : active ? "#fff" : "#64748b",
        fontSize: 15,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export default function ToolSelect({
  polygonCoords,
  polygonClosed,
  setPolygonCoords,
  setPolygonClosed,
}: ToolSelectProps) {
  const mapRef = useMap();
  const map = mapRef?.current?.getMap();

  const [tool, setTool] = useState<0 | 1>(0);
  const [cursorPreview, setCursorPreview] = useState<[number, number] | null>(
    null,
  );

  const dragIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastClickTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!map) return;

    const init = () => {
      if (!map.getSource(SRC_POLYGON)) {
        map.addSource(SRC_POLYGON, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [] },
          } as Feature<Polygon>,
        });
        map.addLayer({
          id: LYR_FILL,
          type: "fill",
          source: SRC_POLYGON,
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: LYR_OUTLINE,
          type: "line",
          source: SRC_POLYGON,
          paint: { "line-color": "#3b82f6", "line-width": 1.5 },
        });
      }
      if (!map.getSource(SRC_VERTICES)) {
        map.addSource(SRC_VERTICES, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          } as FeatureCollection<Point>,
        });
        map.addLayer({
          id: LYR_VERTICES,
          type: "circle",
          source: SRC_VERTICES,
          paint: {
            "circle-radius": 5,
            "circle-color": "#fff",
            "circle-stroke-color": "#3b82f6",
            "circle-stroke-width": 2,
          },
        });
      }
      if (!map.getSource(SRC_PREVIEW)) {
        map.addSource(SRC_PREVIEW, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          } as Feature<LineString>,
        });
        map.addLayer({
          id: LYR_PREVIEW,
          type: "line",
          source: SRC_PREVIEW,
          paint: {
            "line-color": "#3b82f6",
            "line-width": 1.5,
            "line-dasharray": [4, 3],
            "line-opacity": 0.6,
          },
        });
      }
    };

    if (map.isStyleLoaded()) init();
    else map.once("styledata", init);

    return () => {
      [LYR_PREVIEW, LYR_VERTICES, LYR_OUTLINE, LYR_FILL].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      [SRC_PREVIEW, SRC_VERTICES, SRC_POLYGON].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });
    };
  }, [map]);

  useEffect(() => {
    if (!map || !map.getSource(SRC_POLYGON)) return;
    const ring =
      polygonClosed && polygonCoords.length >= 3
        ? [...polygonCoords, polygonCoords[0]]
        : [];
    (map.getSource(SRC_POLYGON) as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: ring.length ? [ring] : [] },
    } as Feature<Polygon>);
    (map.getSource(SRC_VERTICES) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: polygonCoords.map(([lng, lat], i) => ({
        type: "Feature",
        properties: { index: i },
        geometry: { type: "Point", coordinates: [lng, lat] },
      })),
    } as FeatureCollection<Point>);
  }, [map, polygonCoords, polygonClosed]);

  useEffect(() => {
    if (!map || !map.getSource(SRC_PREVIEW)) return;
    const show =
      !polygonClosed && polygonCoords.length >= 1 && cursorPreview !== null;
    (map.getSource(SRC_PREVIEW) as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: show
          ? [polygonCoords[polygonCoords.length - 1], cursorPreview]
          : [],
      },
    } as Feature<LineString>);
  }, [map, cursorPreview, polygonCoords, polygonClosed]);

  useEffect(() => {
    if (!map) return;
    const DBLCLICK_MS = 300;

    const handleClick = (e: MapMouseEvent) => {
      if (tool !== 1 || polygonClosed) return;
      const now = Date.now();
      if (now - lastClickTimeRef.current < DBLCLICK_MS) {
        lastClickTimeRef.current = 0;
        return;
      }
      lastClickTimeRef.current = now;
      setPolygonCoords((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    };

    const handleDblClick = (e: MapMouseEvent) => {
      if (tool !== 1 || polygonClosed) return;
      e.preventDefault();
      if (polygonCoords.length >= 3) {
        setPolygonClosed(true);
        setTool(0);
        setCursorPreview(null);
        lastClickTimeRef.current = 0;
      }
    };

    map.on("click", handleClick);
    map.on("dblclick", handleDblClick);
    return () => {
      map.off("click", handleClick);
      map.off("dblclick", handleDblClick);
    };
  }, [
    map,
    tool,
    polygonClosed,
    polygonCoords.length,
    setPolygonCoords,
    setPolygonClosed,
  ]);

  useEffect(() => {
    if (!map) return;
    const handleMouseMove = (e: MapMouseEvent) => {
      if (tool === 1 && !polygonClosed) {
        setCursorPreview([e.lngLat.lng, e.lngLat.lat]);
        map.getCanvas().style.cursor = "crosshair";
        return;
      }
      if (tool === 0 && polygonClosed && polygonCoords.length > 0) {
        const point = map.project(e.lngLat);
        const near = polygonCoords.some(([lng, lat]) => {
          const vp = map.project({ lng, lat });
          return (point.x - vp.x) ** 2 + (point.y - vp.y) ** 2 < 100;
        });
        map.getCanvas().style.cursor = near ? "grab" : "";
      } else {
        map.getCanvas().style.cursor = "";
      }
    };
    map.on("mousemove", handleMouseMove);
    return () => {
      map.off("mousemove", handleMouseMove);
      if (!isDraggingRef.current) map.getCanvas().style.cursor = "";
    };
  }, [map, tool, polygonClosed, polygonCoords]);

  useEffect(() => {
    if (!map) return;
    const handleMouseDown = (e: MapMouseEvent) => {
      if (tool !== 0 || !polygonClosed || polygonCoords.length === 0) return;
      const point = map.project(e.lngLat);
      let best = -1,
        bestDist = Infinity;
      polygonCoords.forEach(([lng, lat], i) => {
        const vp = map.project({ lng, lat });
        const d = (point.x - vp.x) ** 2 + (point.y - vp.y) ** 2;
        if (d < 100 && d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      if (best >= 0) {
        dragIndexRef.current = best;
        isDraggingRef.current = true;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";
        e.preventDefault();
      }
    };
    const handleMouseMoveDrag = (e: MapMouseEvent) => {
      if (!isDraggingRef.current || dragIndexRef.current === null) return;
      const pos: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setPolygonCoords((prev) => {
        const n = [...prev];
        n[dragIndexRef.current!] = pos;
        return n;
      });
    };
    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        dragIndexRef.current = null;
        map.dragPan.enable();
        map.getCanvas().style.cursor = "grab";
      }
    };
    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMoveDrag);
    map.on("mouseup", handleMouseUp);
    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMoveDrag);
      map.off("mouseup", handleMouseUp);
      map.dragPan.enable();
    };
  }, [map, tool, polygonClosed, polygonCoords, setPolygonCoords]);

  if (!map) return null;

  const handleReset = () => {
    setPolygonCoords([]);
    setPolygonClosed(false);
    setCursorPreview(null);
    setTool(0);
    if (map) map.getCanvas().style.cursor = "";
  };

  const hint = polygonClosed
    ? "Drag vertices to adjust"
    : tool === 1
      ? polygonCoords.length === 0
        ? "Click to place points"
        : polygonCoords.length < 3
          ? `${polygonCoords.length} point${polygonCoords.length > 1 ? "s" : ""} — need ${3 - polygonCoords.length} more`
          : "Double-click to close"
      : "Draw a region to constrain routes";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ToolBtn
          title="Mouse / Edit"
          active={tool === 0}
          onClick={() => {
            setTool(0);
            setCursorPreview(null);
            if (map) map.getCanvas().style.cursor = "";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 0l16 12-7 2-4 8z" />
          </svg>
        </ToolBtn>
        <ToolBtn
          title={polygonClosed ? "Reset to redraw" : "Draw region"}
          active={tool === 1}
          disabled={polygonClosed}
          onClick={() => setTool(1)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </ToolBtn>
        {polygonCoords.length > 0 && (
          <ToolBtn title="Clear region" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </ToolBtn>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{hint}</div>
    </div>
  );
}
