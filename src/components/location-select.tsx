import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "@vis.gl/react-maplibre";
import { PhotonResult, RouteResult } from "../types";
import { geocode, getLoopRoutes, getRoutes } from "../lib/api";
import { Marker, LngLatBounds } from "maplibre-gl";
import { AnimatePresence, motion } from "framer-motion";

interface LocationSelectProps {
  onRoutes: (routes: RouteResult[]) => void;
  targetMiles: number;
  polygon?: [number, number][];
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#0f172a",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const dropdownStyle: React.CSSProperties = {
  position: "fixed",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  overflow: "hidden",
  zIndex: 9999,
  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
};

const dropdownItemStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 12,
  color: "#1e293b",
  cursor: "pointer",
};

function LocationField({
  label,
  value,
  options,
  onInput,
  onSelect,
}: {
  label: string;
  value: PhotonResult | null;
  options: PhotonResult[];
  onInput: (v: string) => void;
  onSelect: (v: PhotonResult | null) => void;
}) {
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const captureRect = () => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  };

  const dropdown =
    open &&
    options.length > 0 &&
    rect &&
    createPortal(
      <div
        style={{
          ...dropdownStyle,
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        }}
      >
        {options.map((opt, i) => (
          <div
            key={opt.id}
            style={{
              ...dropdownItemStyle,
              background: hovered === i ? "#f1f5f9" : "transparent",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onMouseDown={() => {
              onSelect(opt);
              setText(opt.name);
              setOpen(false);
            }}
          >
            {opt.name}
          </div>
        ))}
      </div>,
      document.body,
    );

  return (
    <div ref={containerRef}>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <input
        ref={inputRef}
        style={inputStyle}
        value={text}
        placeholder={`Choose ${label.toLowerCase()}...`}
        onChange={(e) => {
          setText(e.target.value);
          onInput(e.target.value);
          captureRect();
          setOpen(true);
          if (!e.target.value) onSelect(null);
        }}
        onFocus={() => {
          captureRect();
          if (options.length > 0) setOpen(true);
        }}
      />
      {dropdown}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 13,
        height: 13,
        border: "2px solid rgba(255,255,255,0.35)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        verticalAlign: "middle",
        marginRight: 6,
      }}
    />
  );
}

export default function LocationSelect({
  onRoutes,
  targetMiles,
  polygon,
}: LocationSelectProps) {
  const { current: map } = useMap();

  const [start, setStart] = useState<PhotonResult | null>(null);
  const [end, setEnd] = useState<PhotonResult | null>(null);
  const [startOptions, setStartOptions] = useState<PhotonResult[]>([]);
  const [endOptions, setEndOptions] = useState<PhotonResult[]>([]);
  const [loop, setLoop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [foundCount, setFoundCount] = useState(0);
  const [routeError, setRouteError] = useState<string | null>(null);

  const startDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);
  const prevStartId = useRef<number | null>(null);
  const prevEndId = useRef<number | null>(null);

  const debouncedGeocode = useCallback(
    (
      input: string,
      setter: React.Dispatch<React.SetStateAction<PhotonResult[]>>,
      timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setter(await geocode(input));
      }, 250);
    },
    [],
  );

  useEffect(() => {
    if (!map) return;
    const mapInstance = map.getMap();
    startMarker.current?.remove();
    endMarker.current?.remove();
    startMarker.current = null;
    endMarker.current = null;

    const startChanged = (start?.id ?? null) !== prevStartId.current;
    const endChanged = (end?.id ?? null) !== prevEndId.current;
    prevStartId.current = start?.id ?? null;
    prevEndId.current = end?.id ?? null;

    if (loop) {
      if (start?.coordinates) {
        startMarker.current = new Marker({ color: "#2563eb" })
          .setLngLat(start.coordinates)
          .addTo(mapInstance);
        if (startChanged) {
          map.flyTo({ center: start.coordinates, zoom: 13 });
        }
      }
    } else {
      if (start?.coordinates) {
        startMarker.current = new Marker({ color: "#2563eb" })
          .setLngLat(start.coordinates)
          .addTo(mapInstance);
      }
      if (end?.coordinates) {
        endMarker.current = new Marker({ color: "#1e40af" })
          .setLngLat(end.coordinates)
          .addTo(mapInstance);
      }
      if (
        start?.coordinates &&
        end?.coordinates &&
        (start.coordinates[0] !== end.coordinates[0] ||
          start.coordinates[1] !== end.coordinates[1])
      ) {
        if (startChanged || endChanged) {
          const bounds = new LngLatBounds(start.coordinates, start.coordinates);
          bounds.extend(end.coordinates);
          map.fitBounds(bounds, { padding: 80, duration: 800 });
        }
      } else if (start?.coordinates && startChanged) {
        map.flyTo({ center: start.coordinates, zoom: 13 });
      } else if (end?.coordinates && endChanged) {
        map.flyTo({ center: end.coordinates, zoom: 13 });
      }
    }
  }, [start, end, loop, map]);

  useEffect(
    () => () => {
      startMarker.current?.remove();
      endMarker.current?.remove();
    },
    [],
  );

  const canRoute = loop ? !!start : !!(start && end);

  const handleGetRoute = async () => {
    if (!start) return;
    setLoading(true);
    setFoundCount(0);
    setRouteError(null);
    onRoutes([]);

    let results: RouteResult[] = [];
    if (loop) {
      results = await getLoopRoutes(
        start.coordinates,
        targetMiles,
        polygon,
        () => {
          setFoundCount((n) => n + 1);
        },
      );
    } else if (end) {
      results = await getRoutes(start.coordinates, end.coordinates);
    }

    if (results.length > 0) {
      onRoutes(results);
    } else {
      setRouteError("No route found. Try different locations.");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <LocationField
          label="Start"
          value={start}
          options={startOptions}
          onInput={(v) => debouncedGeocode(v, setStartOptions, startDebounce)}
          onSelect={(v) => {
            setStart(v);
            onRoutes([]);
            setRouteError(null);
          }}
        />

        <AnimatePresence>
          {!loop && (
            <motion.div
              key="end"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              <LocationField
                label="End"
                value={end}
                options={endOptions}
                onInput={(v) => debouncedGeocode(v, setEndOptions, endDebounce)}
                onSelect={(v) => {
                  setEnd(v);
                  onRoutes([]);
                  setRouteError(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              userSelect: "none",
              flex: 1,
            }}
          >
            <div
              onClick={() => {
                setLoop((l) => !l);
                onRoutes([]);
                setRouteError(null);
              }}
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: loop ? "#3b82f6" : "#e2e8f0",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: loop ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: "#64748b" }}>Loop</span>
          </label>

          <button
            onClick={handleGetRoute}
            disabled={!canRoute || loading}
            style={{
              flex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              background:
                canRoute && !loading
                  ? "#3b82f6"
                  : loading
                    ? "#3b82f6"
                    : "#f1f5f9",
              color: canRoute || loading ? "#fff" : "#94a3b8",
              fontSize: 13,
              fontWeight: 600,
              cursor: canRoute && !loading ? "pointer" : "default",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {loading && <Spinner />}
            {loading
              ? foundCount > 0
                ? `Found ${foundCount}…`
                : "Finding routes…"
              : "Get Route"}
          </button>
        </div>

        {routeError && (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: -4 }}>
            {routeError}
          </div>
        )}
      </div>
    </>
  );
}
