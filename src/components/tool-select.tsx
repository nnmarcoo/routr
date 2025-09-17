import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import BrushIcon from "@mui/icons-material/Brush";
import MouseIcon from "@mui/icons-material/Mouse";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline"; // eraser option
import { useState } from "react";

export default function ToolSelect() {
  const [tool, setTool] = useState("mouse");

  const handleChange = (
    _: React.MouseEvent<HTMLElement>,
    newTool: string | null,
  ) => {
    if (newTool !== null) setTool(newTool);
  };

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

        <Tooltip title="Brush">
          <ToggleButton value="brush" aria-label="brush">
            <BrushIcon />
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
