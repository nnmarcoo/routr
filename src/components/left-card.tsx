import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  ListItem,
  Stack,
  TextField,
} from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import { useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { geocode } from "../lib/api";
import { PhotonResult } from "../types";

export default function LeftCard() {
  const { current: map } = useMap();

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startLocations, setStartLocations] = useState<PhotonResult[]>([]);
  const [endLocations, setEndLocations] = useState<PhotonResult[]>([]);

  return (
    <Card
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        minWidth: 300,
        boxShadow: 4,
        borderRadius: 2,
        backgroundColor: "white",
      }}
    >
      <CardContent>
        <Stack>
          <ListItem>
            <Autocomplete
              id="start"
              sx={{ width: "100%" }}
              options={startLocations}
              getOptionLabel={(option) => option.name}
              filterOptions={(x) => x}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.id}>
                    {option.name}
                  </li>
                );
              }}
              onInputChange={async (_, input) => {
                const newLocations = await geocode(input);
                if (newLocations.length == 0) return;

                setStartLocations(newLocations);
              }}
              onChange={(_, value) => {
                setStart(value?.name || "");
                if (value?.coordinates && map)
                  map.flyTo({ center: value.coordinates, zoom: 10 });
              }}
              value={startLocations.find((loc) => loc.name === start) || null}
              renderInput={(params) => <TextField {...params} label="Start" />}
              noOptionsText="Type something!"
            />
          </ListItem>

          <ListItem>
            <Autocomplete
              id="end"
              sx={{ width: "100%" }}
              options={endLocations}
              getOptionLabel={(option) => option.name}
              filterOptions={(x) => x}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.id}>
                    {option.name}
                  </li>
                );
              }}
              onInputChange={async (_, input) => {
                const newLocations = await geocode(input);
                if (newLocations.length == 0) return;

                setEndLocations(newLocations);
              }}
              onChange={(_, value) => {
                setEnd(value?.name || "");
                if (value?.coordinates && map)
                  map.flyTo({ center: value.coordinates, zoom: 10 });
              }}
              value={endLocations.find((loc) => loc.name === end) || null}
              renderInput={(params) => <TextField {...params} label="End" />}
              noOptionsText="Type something!"
            />
          </ListItem>
          <ListItem>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="Loop"
            />
          </ListItem>
        </Stack>
      </CardContent>
    </Card>
  );
}
