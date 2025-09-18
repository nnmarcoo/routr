import { Divider, ListItem, IconButton } from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
          left: open ? 350 : 16,
          backgroundColor: "white",
          borderRadius: 2,
          width: 32,
          height: 32,
          boxShadow: 1,
          "&:hover": {
            backgroundColor: "white",
            boxShadow: 3,
          },
        }}
      >
        {open ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>

      <AnimatePresence>
        {open && (
          <motion.div
            key="left-card"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 320 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              bottom: 16,
              overflow: "hidden",
            }}
          >
            <Card sx={{ height: "100%" }}>
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
        )}
      </AnimatePresence>
    </>
  );
}
