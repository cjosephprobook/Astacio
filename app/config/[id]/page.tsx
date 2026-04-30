import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ZipCodeMap from "../../../components/ZipCodeMap";

function dbClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SERVICE_ROLE!, {
    auth: { persistSession: false },
  });
}

export default async function ConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await dbClient()
    .from("configs")
    .select("id, name, zip_codes")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <main style={{ padding: "24px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto 16px" }}>
        <a
          href="/"
          style={{ fontSize: 13, color: "#666", textDecoration: "none" }}
        >
          ← All configs
        </a>
      </div>
      <ZipCodeMap
        configId={data.id}
        configName={data.name}
        zipCodes={data.zip_codes}
      />
    </main>
  );
}
