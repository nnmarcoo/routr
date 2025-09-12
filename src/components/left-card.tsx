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
import { useCallback, useRef, useState, useEffect } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { geocode } from "../lib/api";
import { PhotonResult } from "../types";
import { Marker, LngLatBounds } from "maplibre-gl";

export default function LeftCard() {
  const { current: map } = useMap();

  const [start, setStart] = useState<PhotonResult | null>(null);
  const [end, setEnd] = useState<PhotonResult | null>(null);
  const [startLocations, setStartLocations] = useState<PhotonResult[]>([]);
  const [endLocations, setEndLocations] = useState<PhotonResult[]>([]);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);

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

  useEffect(() => {
    if (!map) return;
    const mapInstance = map.getMap();

    if (start?.coordinates) {
      if (startMarker.current) startMarker.current.setLngLat(start.coordinates);
      else {
        startMarker.current = new Marker({ color: "green" })
          .setLngLat(start.coordinates)
          .addTo(mapInstance);
      }
    } else {
      startMarker.current?.remove();
      startMarker.current = null;
    }

    if (end?.coordinates) {
      if (endMarker.current) endMarker.current.setLngLat(end.coordinates);
      else {
        endMarker.current = new Marker({ color: "red" })
          .setLngLat(end.coordinates)
          .addTo(mapInstance);
      }
    } else {
      endMarker.current?.remove();
      endMarker.current = null;
    }

    if (start?.coordinates && end?.coordinates) {
      const bounds = new LngLatBounds(start.coordinates, start.coordinates);
      bounds.extend(end.coordinates);
      map.fitBounds(bounds, { padding: 50, duration: 800 });
    } else if (start?.coordinates)
      map.flyTo({ center: start.coordinates, zoom: 10 });
    else if (end?.coordinates) map.flyTo({ center: end.coordinates, zoom: 10 });
  }, [start, end, map]);

  // necessary?
  useEffect(() => {
    return () => {
      startMarker.current?.remove();
      endMarker.current?.remove();
    };
  }, []);

  return (
    <Card sx={{ position: "absolute", top: 16, left: 16, minWidth: 300 }}>
      <CardContent>
        <Stack>
          <ListItem>
            <Autocomplete
              id="start"
              sx={{ width: "100%" }}
              options={startLocations}
              value={start}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              filterOptions={(x) => x}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.name}
                </li>
              )}
              onInputChange={(_, input) =>
                debouncedGeocode(input, setStartLocations)
              }
              onChange={(_, value) => setStart(value)}
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
              isOptionEqualToValue={(o, v) => o.id === v.id}
              filterOptions={(x) => x}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.name}
                </li>
              )}
              onInputChange={(_, input) =>
                debouncedGeocode(input, setEndLocations)
              }
              onChange={(_, value) => setEnd(value)}
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
