import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

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
        zIndex: 1,
      }}
    >
      <CardContent>
        <Typography variant="h6">Map Info</Typography>
        <Typography variant="body2" color="text.secondary">
          You can put stats, buttons, or filters here.
        </Typography>
      </CardContent>
    </Card>
  );
}
