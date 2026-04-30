"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

interface Zone {
  id: string;
  name: string;
  color: string;
  zips: string[];
}

interface Props {
  configId: string;
  configName: string;
  zipCodes: string[];
}

const DEFAULT_ZONES: Zone[] = [
  { id: "z1", name: "Zone 1", color: "#4e79a7", zips: [] },
  { id: "z2", name: "Zone 2", color: "#f28e2b", zips: [] },
  { id: "z3", name: "Zone 3", color: "#59a14f", zips: [] },
  { id: "z4", name: "Zone 4", color: "#e15759", zips: [] },
  { id: "z5", name: "Zone 5", color: "#b07aa1", zips: [] },
];

export default function ZipCodeMap({ configId, configName, zipCodes }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zones, setZones] = useState<Zone[]>(DEFAULT_ZONES);
  const [activeZone, setActiveZone] = useState<string>("z1");
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [dimensions, setDimensions] = useState({ width: 900, height: 580 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch geometry for this config's zip codes
  useEffect(() => {
    if (!zipCodes.length) return;
    setLoading(true);
    fetch(`/api/geo?zips=${zipCodes.join(",")}`)
      .then((r) => r.json())
      .then((fc) => setGeoData(fc))
      .finally(() => setLoading(false));
  }, [zipCodes.join(",")]);

  // Load saved zones
  useEffect(() => {
    fetch(`/api/zones/${configId}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.zones) && d.zones.length > 0) {
          setZones(d.zones);
        }
      });
  }, [configId]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height: Math.max(300, width * 0.62) });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const zipToZone = useCallback(
    (zip: string): Zone | undefined =>
      zones.find((z) => z.zips.includes(zip)),
    [zones]
  );

  const handleZipClick = useCallback(
    (zip: string) => {
      setZones((prev) => {
        const next = prev.map((z) => ({
          ...z,
          zips: z.zips.filter((x) => x !== zip),
        }));
        const target = next.find((z) => z.id === activeZone);
        if (target) target.zips = [...target.zips, zip];
        return next;
      });
    },
    [activeZone]
  );

  // Draw map
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !geoData?.features?.length) return;
    const { width, height } = dimensions;

    const validFeatures = geoData.features.filter(
      (f: any) => f.geometry?.coordinates?.length
    );
    if (!validFeatures.length) return;

    const fc = { type: "FeatureCollection", features: validFeatures };

    const PADDING = 32;
    const projection = d3
      .geoMercator()
      .fitExtent([[PADDING, PADDING], [width - PADDING, height - PADDING]], fc as any);
    const path = d3.geoPath(projection);

    const svgEl = d3.select(svg);
    svgEl.selectAll("*").remove();
    svgEl.attr("viewBox", `0 0 ${width} ${height}`);

    const g = svgEl.append("g");

    validFeatures.forEach((f: any) => {
      const zip = f.properties?.zip ?? "";
      const zone = zipToZone(zip);

      g.append("path")
        .datum(f)
        .attr("d", path as any)
        .attr("fill", zone ? zone.color + "cc" : "#d6d2ca")
        .attr("stroke", "#555")
        .attr("stroke-width", 1.2)
        .style("cursor", "pointer")
        .on("click", () => handleZipClick(zip))
        .append("title")
        .text(zip);
    });
  }, [geoData, zones, dimensions, zipToZone, handleZipClick]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/zones/${configId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const unassignedCount = zipCodes.filter((z) => !zipToZone(z)).length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{configName}</h2>
        <span style={{ fontSize: 13, color: "#888" }}>
          {zipCodes.length} zip codes · {unassignedCount} unassigned
        </span>
        <button
          onClick={save}
          disabled={saving}
          style={{
            marginLeft: "auto",
            padding: "6px 16px",
            background: saveStatus === "saved" ? "#59a14f" : saveStatus === "error" ? "#e15759" : "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: saving ? "default" : "pointer",
            fontSize: 13,
          }}
        >
          {saving ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error" : "Save zones"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Map */}
        <div
          ref={containerRef}
          style={{ flex: 1, background: "#f7f5f0", borderRadius: 8, overflow: "hidden", minHeight: 400 }}
        >
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Loading map…</div>
          ) : (
            <svg ref={svgRef} style={{ width: "100%", height: dimensions.height, display: "block" }} />
          )}
        </div>

        {/* Zone panel */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Click a zip to assign
          </p>
          {zones.map((z) => (
            <div
              key={z.id}
              onClick={() => setActiveZone(z.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                marginBottom: 6,
                borderRadius: 6,
                border: `2px solid ${activeZone === z.id ? z.color : "transparent"}`,
                background: activeZone === z.id ? z.color + "18" : "#f3f2ef",
                cursor: "pointer",
              }}
            >
              <div
                style={{ width: 14, height: 14, borderRadius: 3, background: z.color, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{z.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>{z.zips.length}</span>
            </div>
          ))}

          <div style={{ marginTop: 16, padding: "8px 10px", background: "#f3f2ef", borderRadius: 6 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#666", fontWeight: 600 }}>Unassigned</p>
            <p style={{ margin: 0, fontSize: 13 }}>{unassignedCount} zip{unassignedCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
