// Builds pre-projected world country outlines (Natural Earth projection, 960x500) from the world-atlas package.
// usage: node build_world_shapes.mjs <dir with node_modules> <out.json>
import fs from 'fs';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
const [,, dir, out] = process.argv;
const topo = JSON.parse(fs.readFileSync(`${dir}/node_modules/world-atlas/countries-110m.json`, 'utf8'));
const fc = feature(topo, topo.objects.countries);
fc.features = fc.features.filter((f) => f.properties.name !== 'Antarctica');
const proj = geoNaturalEarth1().fitExtent([[4, 4], [956, 496]], fc);
const path = geoPath(proj).digits(1);
const rows = fc.features.map((f) => { const [cx, cy] = path.centroid(f); return { country: f.properties.name, path: path(f), cx: +cx.toFixed(1), cy: +cy.toFixed(1) }; });
fs.writeFileSync(out, JSON.stringify({ rows }));
console.log(rows.length, fs.statSync(out).size);
