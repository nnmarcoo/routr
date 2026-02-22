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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <span style={{ fontSize: 12, color: "#64748b" }}>Distance</span>
      <div style={{ position: "relative", width: 90 }}>
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          }}
          inputMode="decimal"
          style={
            {
              width: "100%",
              boxSizing: "border-box",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "7px 28px 7px 10px",
              color: "#0f172a",
              fontSize: 13,
              outline: "none",
              appearance: "none",
              MozAppearance: "textfield",
            } as React.CSSProperties
          }
        />
        <span
          style={{
            position: "absolute",
            right: 9,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 11,
            color: "#94a3b8",
            pointerEvents: "none",
          }}
        >
          mi
        </span>
      </div>
    </div>
  );
}
