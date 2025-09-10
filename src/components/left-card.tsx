import {
  Checkbox,
  FormControlLabel,
  ListItem,
  Stack,
  TextField,
} from "@mui/material";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

export default function LeftCard() {
  return (
    <Card
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        minWidth: 220,
        boxShadow: 4,
        borderRadius: 2,
        backgroundColor: "white",
      }}
    >
      <CardContent>
        <Stack spacing={1}>
          <ListItem>
            <FormControlLabel
              control={<Checkbox defaultChecked />}
              label="Loop"
            />
          </ListItem>
          <ListItem>
            <TextField label="Beginning" />
            <TextField label="Destination" />
          </ListItem>
        </Stack>
      </CardContent>
    </Card>
  );
}
