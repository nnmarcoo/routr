import {
  Autocomplete,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  ListItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-maplibre";
import { PhotonResult, RouteResult } from "../types";
import { geocode, getRoute, getLoopRoute } from "../lib/api";
import { Marker, LngLatBounds } from "maplibre-gl";

interface LocationSelectProps {
  onRoute: (route: RouteResult | null) => void;
  range: [number, number];
  polygon?: [number, number][];
}

export default function LocationSelect({ onRoute, range, polygon }: LocationSelectProps) {
  const { current: map } = useMap();

  const [start, setStart] = useState<PhotonResult | null>(null);
  const [end, setEnd] = useState<PhotonResult | null>(null);
  const [startLocations, setStartLocations] = useState<PhotonResult[]>([]);
  const [endLocations, setEndLocations] = useState<PhotonResult[]>([]);
  const [loop, setLoop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const startDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMarker = useRef<Marker | null>(null);
  const endMarker = useRef<Marker | null>(null);

  const debouncedGeocode = useCallback(
    (
      input: string,
      setter: React.Dispatch<React.SetStateAction<PhotonResult[]>>,
      timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    ) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
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

  const canRoute = loop ? !!start : !!(start && end);

  const handleGetRoute = async () => {
    if (!start) return;
    setLoading(true);
    setRouteError(null);
    onRoute(null);

    let result: RouteResult | null = null;

    if (loop) {
      const targetMiles = (range[0] + range[1]) / 2;
      result = await getLoopRoute(start.coordinates, targetMiles, polygon);
    } else if (end) {
      result = await getRoute(start.coordinates, end.coordinates);
      if (result) {
        if (result.distanceMiles < range[0] * 0.5) {
          setRouteError(
            `Route is ${result.distanceMiles.toFixed(1)} mi — shorter than your ${range[0]} mi minimum.`,
          );
        } else if (result.distanceMiles > range[1] * 2) {
          setRouteError(
            `Route is ${result.distanceMiles.toFixed(1)} mi — longer than your ${range[1]} mi maximum.`,
          );
        }
      }
    }

    if (result) {
      onRoute(result);
    } else {
      setRouteError("Could not find a route. Try different locations.");
    }
    setLoading(false);
  };

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
            debouncedGeocode(input, setStartLocations, startDebounce)
          }
          onChange={(_, value) => { setStart(value); onRoute(null); setRouteError(null); }}
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
                  debouncedGeocode(input, setEndLocations, endDebounce)
                }
                onChange={(_, value) => { setEnd(value); onRoute(null); setRouteError(null); }}
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
              onChange={(e) => { setLoop(e.target.checked); onRoute(null); setRouteError(null); }}
            />
          }
          label="Loop"
        />
      </ListItem>

      <ListItem>
        <Button
          variant="contained"
          fullWidth
          disabled={!canRoute || loading}
          onClick={handleGetRoute}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? "Routing…" : "Get Route"}
        </Button>
      </ListItem>

      {routeError && (
        <ListItem>
          <Typography variant="caption" color="error">
            {routeError}
          </Typography>
        </ListItem>
      )}
    </Stack>
  );
}
