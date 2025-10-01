import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import CreateIcon from "@mui/icons-material/Create";
import MouseIcon from "@mui/icons-material/Mouse";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useEffect, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { MapMouseEvent } from "maplibre-gl";
import type { Feature, Polygon, LineString } from "geojson";

export default function ToolSelect() {
  const mapRef = useMap();
  const map = mapRef?.current?.getMap();
  const [tool, setTool] = useState(0);
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);

  const handleChange = (_: React.MouseEvent<HTMLElement>, newTool: number) => {
    if (newTool >= 0) setTool(newTool);
    else setTool(0);
  };

  useEffect(() => {
    if (!map) return;

    const handleClick = (e: MapMouseEvent) => {
      if (tool) {
        const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setPolygonCoords((prev) => [...prev, lngLat]);
      }
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, tool]);

  useEffect(() => {
    if (!map) return;

    const sourcePolygon = "drawn-polygon";
    const sourceLine = "drawing-line";
    const sourcePoints = "drawing-points";

    const updateDrawing = () => {
      let polygonCoordsClosed = polygonCoords;
      if (polygonCoords.length > 2) {
        const first = polygonCoords[0];
        const last = polygonCoords[polygonCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          polygonCoordsClosed = [...polygonCoords, first];
        }
      }

      const polygonGeoJSON: Feature<Polygon> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates:
            polygonCoordsClosed.length > 2 ? [polygonCoordsClosed] : [],
        },
      };

      if (map.getSource(sourcePolygon)) {
        (map.getSource(sourcePolygon) as maplibregl.GeoJSONSource).setData(
          polygonGeoJSON,
        );
      } else {
        map.addSource(sourcePolygon, { type: "geojson", data: polygonGeoJSON });
        map.addLayer({
          id: "polygon-fill",
          type: "fill",
          source: sourcePolygon,
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.4 },
        });
        map.addLayer({
          id: "polygon-outline",
          type: "line",
          source: sourcePolygon,
          paint: { "line-color": "#1d4ed8", "line-width": 2 },
        });
      }

      const lineGeoJSON: Feature<LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: polygonCoordsClosed.length < 3 ? polygonCoords : [],
        },
      };

      if (map.getSource(sourceLine)) {
        (map.getSource(sourceLine) as maplibregl.GeoJSONSource).setData(
          lineGeoJSON,
        );
      } else {
        map.addSource(sourceLine, { type: "geojson", data: lineGeoJSON });
        map.addLayer({
          id: "drawing-line",
          type: "line",
          source: sourceLine,
          paint: {
            "line-color": "#facc15",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }

      const pointsGeoJSON = {
        type: "FeatureCollection" as const,
        features: polygonCoords.map(([lng, lat]) => ({
          type: "Feature" as const,
          properties: {},
          geometry: { type: "Point" as const, coordinates: [lng, lat] },
        })),
      };

      if (map.getSource(sourcePoints)) {
        (map.getSource(sourcePoints) as maplibregl.GeoJSONSource).setData(
          pointsGeoJSON,
        );
      } else {
        map.addSource(sourcePoints, { type: "geojson", data: pointsGeoJSON });
        map.addLayer({
          id: "drawing-points",
          type: "circle",
          source: sourcePoints,
          paint: { "circle-radius": 5, "circle-color": "#f87171" },
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateDrawing();
    } else {
      const onStyleLoad = () => {
        updateDrawing();
        map.off("styledata", onStyleLoad);
      };
      map.on("styledata", onStyleLoad);
    }
  }, [map, polygonCoords]);

  if (!map) return null;

  return (
    <>
      <ToggleButtonGroup
        value={tool}
        exclusive
        onChange={handleChange}
        aria-label="drawing tools"
        size="small"
      >
        <Tooltip title="Mouse">
          <ToggleButton value={0} aria-label="mouse">
            <MouseIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Pen">
          <ToggleButton value={1} aria-label="pen">
            <CreateIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Reset">
          <ToggleButton
            value={-1}
            aria-label="Reset polygon"
            onClick={() => {
              setPolygonCoords([]);
            }}
          >
            <RemoveCircleOutlineIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </>
  );
}
