import {
  Checkbox,
  FormControlLabel,
  ListItem,
  Stack,
  TextField,
} from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useState, useEffect } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { geocode } from "../lib/api";

export default function LeftCard() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const { current: map } = useMap();

  useEffect(() => {
  if (!map || !start) return;
  (async () => {
    const coords = await geocode(start);
    console.log(coords);
    if (coords)
      map.flyTo({ center: coords, zoom: 10 });
  })();
}, [start, map]);

useEffect(() => {
  if (!map || !end) return;
  (async () => {
    const coords = await geocode(end);
    if (coords)
      map.flyTo({ center: coords, zoom: 10 });
  })();
}, [end, map])

  return (
    <Card
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        minWidth: 150,
        boxShadow: 4,
        borderRadius: 2,
        backgroundColor: "white",
      }}
    >
      <CardContent>
        <Stack spacing={0}>
          <ListItem>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="Loop"
            />
          </ListItem>
          <ListItem>
            <TextField
              label="Start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </ListItem>
          <ListItem>
            <TextField
              label="End"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </ListItem>
        </Stack>
      </CardContent>
    </Card>
  );
}
