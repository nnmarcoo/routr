import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import CreateIcon from "@mui/icons-material/Create";
import MouseIcon from "@mui/icons-material/Mouse";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline"; // eraser option
import { useEffect, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { MapMouseEvent } from "maplibre-gl";

export default function ToolSelect() {
  const { current: map } = useMap();
  const [tool, setTool] = useState("mouse");

  const handleChange = (
    _: React.MouseEvent<HTMLElement>,
    newTool: string | null,
  ) => {
    if (newTool !== null) setTool(newTool);
  };

  useEffect(() => {
    if (!map) return;

    map.on("click", (e: MapMouseEvent) => {
      console.log("A click event occurred at:", e.lngLat);
    });
  }, [map]);

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
          <ToggleButton value="mouse" aria-label="mouse">
            <MouseIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Pen">
          <ToggleButton value="brush" aria-label="brush">
            <CreateIcon />
          </ToggleButton>
        </Tooltip>

        <Tooltip title="Erase">
          <ToggleButton value="eraser" aria-label="eraser">
            <RemoveCircleOutlineIcon />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </>
  );
}
