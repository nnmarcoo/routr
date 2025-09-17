import { Divider, ListItem } from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useState } from "react";
import ToolSelect from "./tool-select";
import { routeMax, routeMin } from "../lib/constants";
import RangeSelect from "./range-select";
import LocationSelect from "./location-select";

export default function LeftCard() {
  const [range, setRange] = useState<[number, number]>([routeMin, routeMax]);

  return (
    <Card sx={{ position: "absolute", top: 16, left: 16, minWidth: 300, bottom: 16 }}>
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
  );
}
