#!/usr/bin/env node
// Bulk-loads simplified ZCTA GeoJSON into Supabase zip_geometries table.
// Run after: npx mapshaper <shapefile> -simplify 5% keep-shapes -rename-fields zip=ZCTA5CE20 -o format=geojson zctas.geojson

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SERVICE_ROLE;
const GEOJSON_PATH = process.argv[2] ?? resolve(__dirname, "zctas.geojson");
const BATCH_SIZE = 100;
const DELAY_MS = 150;
const MAX_RETRIES = 4;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upsertBatch(batch, attempt = 0) {
  const { error } = await supabase
    .from("zip_geometries")
    .upsert(batch, { onConflict: "zip" });
  if (error) {
    if (attempt < MAX_RETRIES) {
      await sleep(500 * 2 ** attempt);
      return upsertBatch(batch, attempt + 1);
    }
    throw error;
  }
}

console.log(`Reading ${GEOJSON_PATH} ...`);
const raw = readFileSync(GEOJSON_PATH, "utf8");
const geojson = JSON.parse(raw);
const features = geojson.features ?? geojson;
console.log(`Loaded ${features.length} features`);

const rows = features
  .map((f) => {
    const zip = (f.properties?.zip ?? f.properties?.ZCTA5CE20 ?? "")
      .toString()
      .padStart(5, "0");
    if (!zip || zip === "00000") return null;
    return { zip, feature: { ...f, properties: { zip } } };
  })
  .filter(Boolean);

console.log(`${rows.length} valid ZCTAs to upsert`);

let inserted = 0;
let errors = 0;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  try {
    await upsertBatch(batch);
    inserted += batch.length;
  } catch (e) {
    console.error(`\nBatch ${i}-${i + batch.length} failed:`, e.message ?? String(e));
    errors++;
  }

  const pct = Math.round(((i + batch.length) / rows.length) * 100);
  process.stdout.write(`\r${pct}% (${inserted} inserted, ${errors} failed)`);

  if (i + BATCH_SIZE < rows.length) await sleep(DELAY_MS);
}

console.log("\nDone.");
if (errors > 0) console.warn(`${errors} batch(es) permanently failed.`);
else console.log("All ZCTAs loaded successfully.");
