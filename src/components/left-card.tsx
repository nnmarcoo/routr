import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ToolSelect from "./tool-select";
import DistanceInput from "./range-select";
import LocationSelect from "./location-select";
import RouteLayer from "./route-layer";
import RouteTimeline from "./route-timeline";
import {
  ChevronLeft,
  ChevronRight,
  ArrowBackIosNew,
  ArrowForwardIos,
} from "@mui/icons-material";
import { RouteResult } from "../types";
import { IconButton, Tooltip } from "@mui/material";

const panel: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  width: 300,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
  color: "#0f172a",
};

const section: React.CSSProperties = {
  padding: "14px 16px",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "rgba(0,0,0,0.07)",
  margin: "0 16px",
};

export default function LeftCard() {
  const [targetMiles, setTargetMiles] = useState(5);
  const [open, setOpen] = useState(true);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);
  const [polygonClosed, setPolygonClosed] = useState(false);

  const selectedRoute = routes[selectedIndex] ?? null;

  return (
    <>
      <RouteLayer route={selectedRoute} />

      {/* Toggle button */}
      <Tooltip title={open ? "Hide panel" : "Show panel"} placement="right">
        <IconButton
          onClick={() => setOpen((o) => !o)}
          size="small"
          sx={{
            position: "absolute",
            top: 20,
            left: open ? 328 : 20,
            zIndex: 10,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(18px)",
            border: "1px solid rgba(0,0,0,0.08)",
            color: "#0f172a",
            width: 28,
            height: 28,
            transition: "left 0.3s ease",
            "&:hover": { background: "#fff" },
          }}
        >
          {open ? (
            <ChevronLeft fontSize="small" />
          ) : (
            <ChevronRight fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <motion.div
        animate={{ x: open ? 0 : -320, opacity: open ? 1 : 0 }}
        transition={{ type: "tween", duration: 0.28 }}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div style={panel}>
          {/* Location + routing */}
          <div style={section}>
            <LocationSelect
              onRoutes={(r) => {
                setRoutes(r);
                setSelectedIndex(0);
              }}
              targetMiles={targetMiles}
              polygon={polygonClosed ? polygonCoords : undefined}
            />
          </div>

          {/* Route selector */}
          <AnimatePresence>
            {routes.length > 0 && (
              <motion.div
                key="route-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div style={divider} />
                <div style={{ ...section, paddingTop: 10, paddingBottom: 10 }}>
                  {/* Route picker */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => setSelectedIndex((i) => i - 1)}
                      disabled={selectedIndex === 0}
                      sx={{
                        color: "#cbd5e1",
                        "&:not(:disabled)": { color: "#0f172a" },
                        p: 0.5,
                      }}
                    >
                      <ArrowBackIosNew sx={{ fontSize: 14 }} />
                    </IconButton>

                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#0f172a",
                          letterSpacing: "0.02em",
                        }}
                      >
                        Route {selectedIndex + 1}{" "}
                        <span style={{ color: "#94a3b8" }}>
                          / {routes.length}
                        </span>
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}
                      >
                        {selectedRoute?.distanceMiles.toFixed(2)} mi
                        {" · "}
                        {(() => {
                          const m = Math.round(
                            selectedRoute?.durationMinutes ?? 0,
                          );
                          const h = Math.floor(m / 60);
                          const rem = m % 60;
                          return h > 0 ? `${h}h ${rem}m` : `${m}m`;
                        })()}
                      </div>
                    </div>

                    <IconButton
                      size="small"
                      onClick={() => setSelectedIndex((i) => i + 1)}
                      disabled={selectedIndex === routes.length - 1}
                      sx={{
                        color: "#cbd5e1",
                        "&:not(:disabled)": { color: "#0f172a" },
                        p: 0.5,
                      }}
                    >
                      <ArrowForwardIos sx={{ fontSize: 14 }} />
                    </IconButton>
                  </div>

                  {/* Timeline scrubber */}
                  {selectedRoute && <RouteTimeline route={selectedRoute} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={divider} />

          {/* Distance */}
          <div style={section}>
            <DistanceInput value={targetMiles} onChange={setTargetMiles} />
          </div>

          <div style={divider} />

          {/* Drawing tools */}
          <div style={{ ...section, paddingTop: 10, paddingBottom: 10 }}>
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Region
            </div>
            <ToolSelect
              polygonCoords={polygonCoords}
              polygonClosed={polygonClosed}
              setPolygonCoords={setPolygonCoords}
              setPolygonClosed={setPolygonClosed}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}
