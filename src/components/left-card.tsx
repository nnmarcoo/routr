import { useState, useMemo } from "react";
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
import { IconButton, useMediaQuery, Fab } from "@mui/material";

const COLLAPSED_PEEK = 40;

const panel: React.CSSProperties = {
  width: "min(320px, calc(100vw - 32px))",
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

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderBottom: "1px solid rgba(0,0,0,0.06)",
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
  const isMobile = useMediaQuery("(max-width:640px)");

  const [targetMiles, setTargetMiles] = useState(5);
  const [open, setOpen] = useState(true);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);
  const [polygonClosed, setPolygonClosed] = useState(false);

  const selectedRoute = routes[selectedIndex] ?? null;

  const positionStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      top: isMobile ? 8 : 16,
      left: isMobile ? 8 : 16,
      right: isMobile ? 8 : undefined,
      pointerEvents: "auto",
      zIndex: 10,
    }),
    [isMobile],
  );

  const closedX = isMobile
    ? "-110%"
    : `calc(-100% + ${COLLAPSED_PEEK}px)`;

  return (
    <>
      <RouteLayer route={selectedRoute} />

      {/* Mobile floating reopen button */}
      <AnimatePresence>
        {isMobile && !open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 11,
            }}
          >
            <Fab
              size="small"
              onClick={() => setOpen(true)}
              sx={{
                background: "rgba(255,255,255,0.95)",
                color: "#0f172a",
                boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                "&:hover": { background: "#fff" },
              }}
            >
              <ChevronRight fontSize="small" />
            </Fab>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{
          x: open ? 0 : closedX,
          opacity: 1,
        }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        style={positionStyle}
      >
        <div style={panel}>
          {/* Header */}
          <div style={header}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Routes
            </div>

            <IconButton
              size="small"
              onClick={() => setOpen((o) => !o)}
              sx={{ color: "#64748b" }}
            >
              {open ? (
                <ChevronLeft fontSize="small" />
              ) : (
                <ChevronRight fontSize="small" />
              )}
            </IconButton>
          </div>

          {/* Body */}
          <div
            style={{
              pointerEvents: open ? "auto" : "none",
              opacity: open ? 1 : 0.6,
              transition: "opacity 0.2s ease",
            }}
          >
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
                  <div
                    style={{ ...section, paddingTop: 10, paddingBottom: 10 }}
                  >
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
                        onClick={() =>
                          setSelectedIndex((i) => Math.max(0, i - 1))
                        }
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
                          }}
                        >
                          Route {selectedIndex + 1}{" "}
                          <span style={{ color: "#94a3b8" }}>
                            / {routes.length}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            marginTop: 1,
                          }}
                        >
                          {selectedRoute?.distanceMiles.toFixed(2)} mi ·{" "}
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
                        onClick={() =>
                          setSelectedIndex((i) =>
                            Math.min(routes.length - 1, i + 1),
                          )
                        }
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

                    {selectedRoute && (
                      <RouteTimeline route={selectedRoute} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={divider} />

            <div style={section}>
              <DistanceInput
                value={targetMiles}
                onChange={setTargetMiles}
              />
            </div>

            <div style={divider} />

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
        </div>
      </motion.div>
    </>
  );
}