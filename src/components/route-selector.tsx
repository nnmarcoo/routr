import { IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { RouteResult } from "../types";

interface RouteSelectorProps {
  routes: RouteResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function RouteSelector({
  routes,
  selectedIndex,
  onSelect,
}: RouteSelectorProps) {
  if (routes.length === 0) return null;

  const route = routes[selectedIndex];
  const miles = route.distanceMiles.toFixed(1);
  const mins = Math.round(route.durationMinutes);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  const duration = hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
    >
      <IconButton
        size="small"
        onClick={() => onSelect(selectedIndex - 1)}
        disabled={selectedIndex === 0}
      >
        <ArrowBackIosNewIcon fontSize="small" />
      </IconButton>

      <Stack alignItems="center" spacing={0}>
        <Typography variant="body2" fontWeight={600}>
          Route {selectedIndex + 1} / {routes.length}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {miles} mi · {duration}
        </Typography>
      </Stack>

      <IconButton
        size="small"
        onClick={() => onSelect(selectedIndex + 1)}
        disabled={selectedIndex === routes.length - 1}
      >
        <ArrowForwardIosIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
