import { Map } from '@vis.gl/react-maplibre';
import { middleOfUSA } from './lib/constants';
import YouAreHere from './components/you-are-here';

export default function App() {
  return (
    <Map
      initialViewState={{
        longitude: middleOfUSA[0],
        latitude: middleOfUSA[1],
        zoom: 2
      }}
      // mapStyle="/styles/dark.json"
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
    >
      <YouAreHere />
    </Map>
  );
}