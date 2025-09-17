import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  ListItem,
  Stack,
  TextField,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { PhotonResult } from "../types";
import { geocode } from "../lib/api";
import { Marker, LngLatBounds } from "maplibre-gl";

export default function LocationSelect() {
  const { current: map } = useMap();

  const [start, setStart] = useState<PhotonResult | null>(null);
  const [end, setEnd] = useState<PhotonResult | null>(null);
  const [startLocations, setStartLocations] = useState<PhotonResult[]>([]);
  const [endLocations, setEndLocations] = useState<PhotonResult[]>([]);
  const [loop, setLoop] = useState(false);

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

    startMarker.current?.remove();
    endMarker.current?.remove();
    startMarker.current = null;
    endMarker.current = null;

    if (loop) {
      if (start?.coordinates) {
        startMarker.current = new Marker({ color: "orange" })
          .setLngLat(start.coordinates)
          .addTo(mapInstance);
        map.flyTo({ center: start.coordinates, zoom: 10 });
      }
    } else {
      if (start?.coordinates) {
        startMarker.current = new Marker({ color: "green" })
          .setLngLat(start.coordinates)
          .addTo(mapInstance);
      }
      if (end?.coordinates) {
        endMarker.current = new Marker({ color: "red" })
          .setLngLat(end.coordinates)
          .addTo(mapInstance);
      }

      if (
        start?.coordinates &&
        end?.coordinates &&
        (start.coordinates[0] !== end.coordinates[0] ||
          start.coordinates[1] !== end.coordinates[1])
      ) {
        const bounds = new LngLatBounds(start.coordinates, start.coordinates);
        bounds.extend(end.coordinates);
        map.fitBounds(bounds, { padding: 50, duration: 800 });
      } else if (start?.coordinates) {
        map.flyTo({ center: start.coordinates, zoom: 10 });
      } else if (end?.coordinates) {
        map.flyTo({ center: end.coordinates, zoom: 10 });
      }
    }
  }, [start, end, loop, map]);

  useEffect(() => {
    return () => {
      startMarker.current?.remove();
      endMarker.current?.remove();
    };
  }, []);

  return (
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

      <AnimatePresence>
        {!loop && (
          <motion.div
            key="end-autocomplete"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      <ListItem>
        <FormControlLabel
          control={
            <Checkbox
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
          }
          label="Loop"
        />
      </ListItem>
    </Stack>
  );
}
