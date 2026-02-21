import { Box, Slider, Stack, TextField, Typography } from "@mui/material";
import { routeMin, routeMax } from "../lib/constants";

interface RangeSelectProps {
  range: [number, number];
  setRange: (r: [number, number]) => void;
}

export default function RangeSelect({ range, setRange }: RangeSelectProps) {
  return (
    <Box sx={{ width: "100%" }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
      >
        <Typography>Range (mi)</Typography>

        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            value={range[0]}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) setRange([val, range[1]]);
            }}
            type="number"
            sx={{ width: 70 }}
            slotProps={{
              htmlInput: {
                min: routeMin,
                max: routeMax,
              },
            }}
          />

          <TextField
            size="small"
            value={range[1]}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (!isNaN(val)) setRange([range[0], val]);
            }}
            type="number"
            sx={{ width: 70 }}
            slotProps={{
              htmlInput: {
                min: routeMin,
                max: routeMax,
              },
            }}
          />
        </Stack>
      </Stack>

      <Slider
        min={routeMin}
        max={routeMax}
        value={range}
        onChange={(_, v) => setRange(v as [number, number])}
        valueLabelDisplay="auto"
        getAriaLabel={() => "Route range"}
      />
    </Box>
  );
}
