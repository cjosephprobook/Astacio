import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SERVICE_ROLE!;

function client() {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const docId = `zones-${id}`;
  const { data, error } = await client()
    .from("app_state")
    .select("data, updated_at")
    .eq("id", docId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    zones: data?.data ?? [],
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (!Array.isArray(body?.zones)) {
    return NextResponse.json(
      { error: "Body must be { zones: Zone[] }" },
      { status: 400 }
    );
  }

  const { error } = await client()
    .from("app_state")
    .upsert({
      id: `zones-${id}`,
      data: body.zones,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
