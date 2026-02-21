import { IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import CreateIcon from "@mui/icons-material/Create";
import MouseIcon from "@mui/icons-material/Mouse";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { MapMouseEvent } from "maplibre-gl";
import type { Feature, Polygon, LineString, FeatureCollection, Point } from "geojson";

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

export default function ToolSelect({
  polygonCoords,
  polygonClosed,
  setPolygonCoords,
  setPolygonClosed,
}: ToolSelectProps) {
  const mapRef = useMap();
  const map = mapRef?.current?.getMap();

  const [tool, setTool] = useState<0 | 1>(0);
  const [cursorPreview, setCursorPreview] = useState<[number, number] | null>(null);

  const dragIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const lastClickTimeRef = useRef<number>(0);

  // Effect 1: Initialize MapLibre sources and layers once
  useEffect(() => {
    if (!map) return;

    const initSources = () => {
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
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: LYR_OUTLINE,
          type: "line",
          source: SRC_POLYGON,
          paint: { "line-color": "#2563eb", "line-width": 2 },
        });
      }

      if (!map.getSource(SRC_VERTICES)) {
        map.addSource(SRC_VERTICES, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] } as FeatureCollection<Point>,
        });
        map.addLayer({
          id: LYR_VERTICES,
          type: "circle",
          source: SRC_VERTICES,
          paint: {
            "circle-radius": 6,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#2563eb",
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
            "line-color": "#2563eb",
            "line-width": 1.5,
            "line-dasharray": [4, 3],
            "line-opacity": 0.7,
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      initSources();
    } else {
      map.once("styledata", initSources);
    }

    return () => {
      // Remove layers before sources
      [LYR_PREVIEW, LYR_VERTICES, LYR_OUTLINE, LYR_FILL].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      [SRC_PREVIEW, SRC_VERTICES, SRC_POLYGON].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });
    };
  }, [map]);

  // Effect 2: Sync polygon fill + vertex circles to MapLibre on state change
  useEffect(() => {
    if (!map || !map.getSource(SRC_POLYGON)) return;

    const closedRing =
      polygonClosed && polygonCoords.length >= 3
        ? [...polygonCoords, polygonCoords[0]]
        : [];

    (map.getSource(SRC_POLYGON) as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: closedRing.length > 0 ? [closedRing] : [],
      },
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

  // Effect 3: Sync cursor preview line
  useEffect(() => {
    if (!map || !map.getSource(SRC_PREVIEW)) return;

    const shouldShow =
      !polygonClosed && polygonCoords.length >= 1 && cursorPreview !== null;

    (map.getSource(SRC_PREVIEW) as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: shouldShow
          ? [polygonCoords[polygonCoords.length - 1], cursorPreview]
          : [],
      },
    } as Feature<LineString>);
  }, [map, cursorPreview, polygonCoords, polygonClosed]);

  // Effect 4: Click + dblclick handlers for drawing
  useEffect(() => {
    if (!map) return;

    const DBLCLICK_MS = 300;

    const handleClick = (e: MapMouseEvent) => {
      if (tool !== 1 || polygonClosed) return;
      const now = Date.now();
      // Suppress the second rapid click that arrives as part of a dblclick sequence
      if (now - lastClickTimeRef.current < DBLCLICK_MS) {
        lastClickTimeRef.current = 0;
        return;
      }
      lastClickTimeRef.current = now;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setPolygonCoords((prev) => [...prev, lngLat]);
    };

    const handleDblClick = (e: MapMouseEvent) => {
      if (tool !== 1 || polygonClosed) return;
      e.preventDefault(); // stop map zoom-on-dblclick
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
  }, [map, tool, polygonClosed, polygonCoords.length, setPolygonCoords, setPolygonClosed]);

  // Effect 5: Mousemove for cursor preview and cursor style
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
        const nearVertex = polygonCoords.some(([lng, lat]) => {
          const vp = map.project({ lng, lat });
          const dx = point.x - vp.x;
          const dy = point.y - vp.y;
          return dx * dx + dy * dy < 100; // 10px radius
        });
        map.getCanvas().style.cursor = nearVertex ? "grab" : "";
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

  // Effect 6: Vertex drag handlers
  useEffect(() => {
    if (!map) return;

    const HIT_RADIUS_SQ = 100; // 10px squared

    const handleMouseDown = (e: MapMouseEvent) => {
      if (tool !== 0 || !polygonClosed || polygonCoords.length === 0) return;

      const point = map.project(e.lngLat);
      let closestIndex = -1;
      let closestDist = Infinity;

      polygonCoords.forEach(([lng, lat], i) => {
        const vp = map.project({ lng, lat });
        const dx = point.x - vp.x;
        const dy = point.y - vp.y;
        const dist = dx * dx + dy * dy;
        if (dist < HIT_RADIUS_SQ && dist < closestDist) {
          closestDist = dist;
          closestIndex = i;
        }
      });

      if (closestIndex >= 0) {
        dragIndexRef.current = closestIndex;
        isDraggingRef.current = true;
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";
        e.preventDefault();
      }
    };

    const handleMouseMoveDrag = (e: MapMouseEvent) => {
      if (!isDraggingRef.current || dragIndexRef.current === null) return;
      const newPos: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setPolygonCoords((prev) => {
        const next = [...prev];
        next[dragIndexRef.current!] = newPos;
        return next;
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

  const handleToolChange = (_: React.MouseEvent<HTMLElement>, newTool: number | null) => {
    if (newTool !== null) {
      setTool(newTool as 0 | 1);
      setCursorPreview(null);
      if (map) map.getCanvas().style.cursor = "";
    }
  };

  const handleReset = () => {
    setPolygonCoords([]);
    setPolygonClosed(false);
    setCursorPreview(null);
    setTool(0);
    if (map) map.getCanvas().style.cursor = "";
  };

  if (!map) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <ToggleButtonGroup
        value={tool}
        exclusive
        onChange={handleToolChange}
        aria-label="drawing tools"
        size="small"
      >
        <Tooltip title="Mouse">
          <ToggleButton value={0} aria-label="mouse">
            <MouseIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title={polygonClosed ? "Polygon closed — reset to redraw" : "Draw region"}>
          <span>
            <ToggleButton value={1} aria-label="draw region" disabled={polygonClosed}>
              <CreateIcon />
            </ToggleButton>
          </span>
        </Tooltip>
      </ToggleButtonGroup>

      <Tooltip title="Reset drawing">
        <IconButton size="small" aria-label="reset polygon" onClick={handleReset}>
          <RemoveCircleOutlineIcon />
        </IconButton>
      </Tooltip>
    </div>
  );
}
