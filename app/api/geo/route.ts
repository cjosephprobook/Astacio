import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SERVICE_ROLE!;

function client() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("zips") ?? "";
  const zips = raw
    .split(",")
    .map((z) => z.trim().padStart(5, "0"))
    .filter(Boolean);

  if (!zips.length) {
    return NextResponse.json({ features: [] });
  }

  const { data, error } = await client()
    .from("zip_geometries")
    .select("feature")
    .in("zip", zips);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    type: "FeatureCollection",
    features: (data ?? []).map((r) => r.feature),
  });
}
