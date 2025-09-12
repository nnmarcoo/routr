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
import { useCallback, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { geocode } from "../lib/api";
import { PhotonResult } from "../types";

export default function LeftCard() {
  const { current: map } = useMap();

  const [start, setStart] = useState<PhotonResult | null>(null);
  const [end, setEnd] = useState<PhotonResult | null>(null);
  const [startLocations, setStartLocations] = useState<PhotonResult[]>([]);
  const [endLocations, setEndLocations] = useState<PhotonResult[]>([]);

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedGeocode = useCallback(
    (
      input: string,
      setter: React.Dispatch<React.SetStateAction<PhotonResult[]>>,
    ) => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

      debounceTimeout.current = setTimeout(async () => {
        const newLocations = await geocode(input);
        setter(newLocations);
      }, 250);
    },
    [],
  );

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
              value={start}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(x) => x}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.name}
                </li>
              )}
              onInputChange={(_, input) =>
                debouncedGeocode(input, setStartLocations)
              }
              onChange={(_, value) => {
                setStart(value);
                if (value?.coordinates && map)
                  map.flyTo({ center: value.coordinates, zoom: 10 });
              }}
              renderInput={(params) => <TextField {...params} label="Start" />}
              noOptionsText="Type something!"
            />
          </ListItem>
          <ListItem>
            <Autocomplete
              id="end"
              sx={{ width: "100%" }}
              options={endLocations}
              value={end}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(x) => x}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.name}
                </li>
              )}
              onInputChange={(_, input) =>
                debouncedGeocode(input, setEndLocations)
              }
              onChange={(_, value) => {
                setEnd(value);
                if (value?.coordinates && map)
                  map.flyTo({ center: value.coordinates, zoom: 10 });
              }}
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
