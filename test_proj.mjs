import * as d3 from "./node_modules/d3/src/index.js";

const res = await fetch("http://localhost:3000/api/geo?zips=08037,08201,08203");
const fc = await res.json();

const W = 800, H = 500, PAD = 32;
const proj = d3.geoMercator().fitSize([W - PAD*2, H - PAD*2], fc);
const [tx, ty] = proj.translate();
proj.translate([tx + PAD, ty + PAD]);
const path = d3.geoPath(proj);

for (const f of fc.features) {
  const zip = f.properties.zip;
  const d = path(f) ?? "";
  const rings = f.geometry.coordinates.length;
  const pts = f.geometry.coordinates[0].length;
  const firstProj = proj(f.geometry.coordinates[0][0]);
  const centroid = path.centroid(f);
  console.log(`zip=${zip}  rings=${rings}  pts=${pts}  path_len=${d.length}  first_proj=${firstProj?.map(n=>n.toFixed(1))}  centroid=${centroid?.map(n=>n.toFixed(1))}`);
  // Show the first 150 chars of the path
  console.log("  path:", d.slice(0, 150));
  console.log();
}
