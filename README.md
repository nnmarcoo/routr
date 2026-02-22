# routr

**Discover running routes around you.**

Routr generates loop and point-to-point running routes using real road data from OpenStreetMap. Tell it where you want to run and how far, and it finds multiple route variants with different geometries so you can explore new paths.

**[Try it live](https://nnmarcoo.github.io/routr)**

---

## Features

- **Loop routes** — Generate circular routes from a starting point at a target distance (0.5–26.2 mi)
- **Point-to-point routes** — Find routes between two locations with alternative variants
- **Region constraints** — Draw a polygon on the map to keep routes within a specific area
- **Multiple variants** — Several route suggestions with distinct geometries
- **Geolocation** — Automatically centers on your current location

## Stack

| Layer     | Technology                   |
| --------- | ---------------------------- |
| Framework | React 18 + TypeScript        |
| Bundler   | Vite                         |
| UI        | Material UI, Framer Motion   |
| Map       | MapLibre GL + OpenFreeMap    |
| Routing   | Valhalla (openstreetmap.de)  |
| Road data | Overpass API (OpenStreetMap) |
| Geocoding | Photon (komoot)              |

No API keys required — all services are open and free.

## Getting Started

```sh
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

| Script         | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Start dev server         |
| `pnpm build`   | Production build         |
| `pnpm preview` | Preview production build |
| `pnpm lint`    | Lint with ESLint         |
| `pnpm format`  | Format with Prettier     |
| `pnpm deploy`  | Deploy to GitHub Pages   |

## How It Works

### Loop route generation

1. Fetches walkable roads from Overpass in the target area
2. Builds a junction graph — only true intersections and dead ends become nodes, shrinking the search space
3. DFS with backtracking finds candidate loops near the target distance
4. Each candidate is scored by distance accuracy, diversity (unique grid cells covered), and backtrack ratio
5. Near-duplicate routes are dropped via Jaccard similarity on a spatial grid
6. Results stream to the UI as they're found

Phase-aware angle scoring pushes routes outward in the first half and back in the second.

### Point-to-point routes

Queries the Valhalla routing engine for pedestrian routes between two locations, requesting alternatives with varied geometries.

## Project Structure

```
src/
├── components/
│   ├── left-card.tsx         # Main sidebar UI
│   ├── location-select.tsx   # Location search with geocoding
│   ├── route-layer.tsx       # Map route rendering (gradient + arrows)
│   ├── route-selector.tsx    # Navigate between route variants
│   ├── route-timeline.tsx    # Route stats display
│   ├── range-select.tsx      # Distance slider
│   ├── tool-select.tsx       # Polygon drawing tool
│   └── you-are-here.tsx      # Current location marker
└── lib/
    ├── api.ts                # Core routing algorithms
    ├── geometry.ts           # Point-in-polygon, spatial helpers
    ├── constants.ts          # App-wide configuration
    └── help.ts               # Location formatting
```
