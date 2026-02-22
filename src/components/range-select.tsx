import { InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { routeMin, routeMax } from "../lib/constants";
import { useState } from "react";

interface DistanceInputProps {
  value: number;
  onChange: (v: number) => void;
}

export default function DistanceInput({ value, onChange }: DistanceInputProps) {
  const [raw, setRaw] = useState(String(value));

  const commit = (s: string) => {
    const v = parseFloat(s);
    if (!isNaN(v) && v >= routeMin && v <= routeMax) {
      onChange(v);
      setRaw(String(v));
    } else {
      setRaw(String(value));
    }
  };

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
      <Typography>Distance</Typography>
      <TextField
        size="small"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
        sx={{
          width: 90,
          "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button": { display: "none" },
          "& input[type=number]": { MozAppearance: "textfield" },
        }}
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">mi</InputAdornment> },
          htmlInput: { inputMode: "decimal" },
        }}
      />
    </Stack>
  );
}
