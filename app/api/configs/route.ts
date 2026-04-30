import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SERVICE_ROLE!;

function client() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET() {
  const { data, error } = await client()
    .from("configs")
    .select("id, name, zip_codes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = body?.name?.trim();
  const zip_codes: string[] = (body?.zip_codes ?? [])
    .map((z: string) => z.trim().padStart(5, "0"))
    .filter(Boolean);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!zip_codes.length) {
    return NextResponse.json({ error: "zip_codes must be non-empty" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const { error } = await client()
    .from("configs")
    .insert({ id, name, zip_codes });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id }, { status: 201 });
}
