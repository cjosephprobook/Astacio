import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SERVICE_ROLE;

function client() {
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SERVICE_ROLE environment variables"
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const DOC_ID = "zones";

export async function GET() {
  try {
    const { data, error } = await client()
      .from("app_state")
      .select("data, updated_at")
      .eq("id", DOC_ID)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      zones: data?.data ?? [],
      updatedAt: data?.updated_at ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
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
        id: DOC_ID,
        data: body.zones,
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
