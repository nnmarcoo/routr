import { Divider, ListItem, IconButton } from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useState } from "react";
import { motion } from "framer-motion";
import ToolSelect from "./tool-select";
import { routeMax, routeMin } from "../lib/constants";
import RangeSelect from "./range-select";
import LocationSelect from "./location-select";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";

export default function LeftCard() {
  const [range, setRange] = useState<[number, number]>([routeMin, routeMax]);
  const [open, setOpen] = useState(true);

  return (
    <>
      <IconButton
        onClick={() => setOpen((o) => !o)}
        sx={{
          position: "absolute",
          top: 16,
          left: open ? 324 : 16,
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
          bottom: 16,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <Card sx={{ height: "100dvh", width: 300 }}>
          <CardContent>
            <LocationSelect />
            <ListItem>
              <RangeSelect range={range} setRange={setRange} />
            </ListItem>
            <Divider />
            <ListItem>
              <ToolSelect />
            </ListItem>
            <Divider />
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
