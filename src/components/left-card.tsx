import { Divider, ListItem, IconButton } from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useState } from "react";
import { motion } from "framer-motion";
import ToolSelect from "./tool-select";
import DistanceInput from "./range-select";
import LocationSelect from "./location-select";
import RouteLayer from "./route-layer";
import RouteSelector from "./route-selector";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { RouteResult } from "../types";

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

      <IconButton
        onClick={() => setOpen((o) => !o)}
        sx={{
          position: "absolute",
          top: 16,
          left: open ? 330 : 16,
          backgroundColor: "white",
          borderRadius: 2,
          width: 32,
          height: 32,
          boxShadow: 1,
          transition: "left 0.3s ease",
          "&:hover": { backgroundColor: "white", boxShadow: 3 },
        }}
      >
        {open ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>

      <motion.div
        animate={{ x: open ? 0 : -320, opacity: open ? 1 : 0 }}
        transition={{ type: "tween", duration: 0.3 }}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <Card sx={{ width: 300 }}>
          <CardContent>
            <LocationSelect
              onRoutes={(r) => { setRoutes(r); setSelectedIndex(0); }}
              targetMiles={targetMiles}
              polygon={polygonClosed ? polygonCoords : undefined}
            />
            {routes.length > 0 && (
              <ListItem>
                <RouteSelector
                  routes={routes}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                />
              </ListItem>
            )}
            <ListItem>
              <DistanceInput value={targetMiles} onChange={setTargetMiles} />
            </ListItem>
            <Divider />
            <ListItem>
              <ToolSelect
                polygonCoords={polygonCoords}
                polygonClosed={polygonClosed}
                setPolygonCoords={setPolygonCoords}
                setPolygonClosed={setPolygonClosed}
              />
            </ListItem>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
