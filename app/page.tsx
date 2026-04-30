"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const ZONE_PALETTE = [
  "#e15759", "#f28e2b", "#4e79a7", "#59a14f", "#b07aa1",
  "#76b7b2", "#edc948", "#ff9da7", "#9c755f", "#bab0ac",
];

type Zone = { id: string; name: string; color: string; zips: string[]; locked: boolean };

export default function Page() {
  const mapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(true);
  const [features, setFeatures] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(false);

  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [selectedZips, setSelectedZips] = useState<Set<string>>(new Set());

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zoom persistence — survive map redraws caused by state changes
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgNodeRef = useRef<SVGSVGElement | null>(null);

  // Load persisted zones on mount
  useEffect(() => {
    fetch("/api/zones")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (Array.isArray(j.zones)) setZones(j.zones);
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/zones", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zones }),
        });
        setSaveStatus(r.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [zones]);

  // Keep activeZoneId pointing at a valid unlocked zone
  useEffect(() => {
    if (!zones.length) return;
    const valid = !!activeZoneId && zones.some((z) => z.id === activeZoneId && !z.locked);
    if (!valid) {
      const first = zones.find((z) => !z.locked);
      if (first) setActiveZoneId(first.id);
    }
  }, [zones, activeZoneId]);

  const zipToZone = useMemo(() => {
    const m = new Map<string, Zone>();
    zones.forEach((z) => z.zips.forEach((zip) => m.set(zip, z)));
    return m;
  }, [zones]);

  // Stable refs so D3 handlers don't go stale between renders
  const selectedRef = useRef(selectedZips);
  const zipToZoneRef = useRef(zipToZone);
  selectedRef.current = selectedZips;
  zipToZoneRef.current = zipToZone;

  const loadZips = async () => {
    const zips = input
      .split(/[\s,\n]+/)
      .map((z) => z.trim())
      .filter((z) => /^\d{3,5}$/.test(z))
      .map((z) => z.padStart(5, "0"));
    if (!zips.length) return;
    setFetching(true);
    setFeatures([]);
    setNotFound([]);
    const res = await fetch(`/api/geo?zips=${zips.join(",")}`);
    const fc = await res.json();
    const returned = (fc.features ?? []) as any[];
    const returnedZips = new Set(returned.map((f: any) => f.properties?.zip));
    setNotFound(zips.filter((z) => !returnedZips.has(z)));
    setFeatures(returned);
    setFetching(false);
    setShowInput(false);
  };

  const toggleZip = useCallback((zip: string) => {
    const z = zipToZoneRef.current.get(zip);
    if (z?.locked) return;
    if (z) {
      setZones((prev) =>
        prev.map((zone) =>
          zone.id === z.id ? { ...zone, zips: zone.zips.filter((q) => q !== zip) } : zone
        )
      );
      return;
    }
    setSelectedZips((prev) => {
      const next = new Set(prev);
      if (next.has(zip)) next.delete(zip);
      else next.add(zip);
      return next;
    });
  }, []);

  const assignSelection = () => {
    if (!activeZoneId || !selectedZips.size) return;
    setZones(
      zones.map((z) => {
        if (z.locked) return z;
        if (z.id === activeZoneId)
          return { ...z, zips: Array.from(new Set([...z.zips, ...selectedZips])) };
        return { ...z, zips: z.zips.filter((zip) => !selectedZips.has(zip)) };
      })
    );
    setSelectedZips(new Set());
  };

  const createZone = () => {
    const id = `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const name = `Zone ${String.fromCharCode(65 + zones.length)}`;
    const color = ZONE_PALETTE[zones.length % ZONE_PALETTE.length];
    setZones((prev) => [...prev, { id, name, color, zips: [], locked: false }]);
    setActiveZoneId(id);
  };

  const removeFromZone = (zoneId: string, zip: string) =>
    setZones(zones.map((z) =>
      z.id === zoneId && !z.locked ? { ...z, zips: z.zips.filter((q) => q !== zip) } : z
    ));

  const toggleLock = (id: string) =>
    setZones(zones.map((z) => (z.id === id ? { ...z, locked: !z.locked } : z)));

  const deleteZone = (id: string) => {
    if (zones.find((z) => z.id === id)?.locked) return;
    setZones(zones.filter((z) => z.id !== id));
    if (activeZoneId === id) setActiveZoneId(null);
  };

  const renameZone = (id: string, name: string) =>
    setZones(zones.map((z) => (z.id === id ? { ...z, name } : z)));

  const copyZips = (zone: Zone) =>
    typeof navigator !== "undefined" && navigator.clipboard?.writeText(zone.zips.join(", "));

  const resetZoom = () => {
    if (svgNodeRef.current && zoomBehaviorRef.current) {
      d3.select(svgNodeRef.current)
        .transition()
        .duration(300)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
      zoomTransformRef.current = d3.zoomIdentity;
    }
  };

  // Draw map
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.innerHTML = "";
    if (!features.length) return;

    const W = 760;
    const H = 500;
    const PAD = 40;

    const svg = d3
      .select(mapRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", "100%")
      .style("display", "block");

    // Manual Mercator — d3.geoMercator().fitSize() is broken in this env
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const f of features) {
      const rings: number[][][] =
        f.geometry.type === "MultiPolygon"
          ? f.geometry.coordinates.flat(1)
          : f.geometry.coordinates;
      for (const ring of rings)
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
    }

    const toRad = Math.PI / 180;
    const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * toRad) / 2));
    const scaleX = (W - PAD * 2) / ((maxLng - minLng) * toRad);
    const scaleY = (H - PAD * 2) / (mercY(maxLat) - mercY(minLat));
    const scale = Math.min(scaleX, scaleY);
    const cLng = (minLng + maxLng) / 2;
    const cLat = (minLat + maxLat) / 2;
    const tx = W / 2 - scale * cLng * toRad;
    const ty = H / 2 + scale * mercY(cLat);

    const project = ([lng, lat]: number[]): [number, number] => [
      tx + scale * lng * toRad,
      ty - scale * mercY(lat),
    ];

    const toPathD = (f: any): string => {
      const polys: number[][][][] =
        f.geometry.type === "MultiPolygon"
          ? f.geometry.coordinates
          : [f.geometry.coordinates];
      return polys
        .map((poly) =>
          poly
            .map((ring) =>
              "M" +
              ring
                .map(project)
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join("L") +
              "Z"
            )
            .join("")
        )
        .join("");
    };

    const tooltip = d3
      .select(tooltipRef.current)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "#fff")
      .style("border", "1px solid #d3d1c7")
      .style("border-radius", "6px")
      .style("padding", "6px 10px")
      .style("font-size", "12px")
      .style("opacity", 0)
      .style("z-index", 10)
      .style("white-space", "nowrap")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.08)");

    const g = svg.append("g");

    // Zoom — scroll to zoom, drag to pan, click still fires for small movements
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 30])
      .clickDistance(4)
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
        zoomTransformRef.current = event.transform;
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;
    svgNodeRef.current = svg.node();

    // Restore previous zoom level so redrawing doesn't reset to fit-view
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }

    features.forEach((f: any) => {
      const zip = f.properties?.zip ?? "";
      const zone = zipToZoneRef.current.get(zip);
      const isSelected = selectedRef.current.has(zip);

      const fillColor = zone ? zone.color + "cc" : isSelected ? "#1a1a1a44" : "#d6d2cacc";
      const strokeColor = isSelected ? "#1a1a1a" : zone ? zone.color : "#fff";
      const strokeWidth = isSelected ? 2.5 : zone ? 2 : 0.6;

      const path = g
        .append("path")
        .attr("d", toPathD(f))
        .attr("fill", fillColor)
        .attr("stroke", strokeColor)
        .attr("stroke-width", strokeWidth)
        .style("cursor", "pointer");

      path.on("click", () => toggleZip(zip));

      path.on("mouseover", function (_event: MouseEvent) {
        const z = zipToZoneRef.current.get(zip);
        const zoneTag = z
          ? `<div style="margin-top:3px;color:${z.color};font-weight:600">${z.name}${z.locked ? " (locked)" : ""}</div>`
          : "";
        tooltip.style("opacity", 1).html(`<strong>${zip}</strong>${zoneTag}`);
      });

      path.on("mousemove", function (event: MouseEvent) {
        const rect = mapRef.current!.getBoundingClientRect();
        tooltip
          .style("left", event.clientX - rect.left + 12 + "px")
          .style("top", event.clientY - rect.top + 12 + "px");
      });

      path.on("mouseout", () => tooltip.style("opacity", 0));

      if (showLabels) {
        const outerRing: number[][] =
          f.geometry.type === "MultiPolygon"
            ? f.geometry.coordinates[0][0]
            : f.geometry.coordinates[0];
        const pts = outerRing.map(project);
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        g.append("text")
          .attr("x", cx).attr("y", cy)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("font-size", 10).attr("font-weight", "600")
          .attr("stroke", "#fff").attr("stroke-width", 2.5).attr("stroke-linejoin", "round")
          .attr("pointer-events", "none").text(zip);
        g.append("text")
          .attr("x", cx).attr("y", cy)
          .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
          .attr("font-size", 10).attr("font-weight", "600")
          .attr("fill", "#1a1a1a").attr("pointer-events", "none").text(zip);
      }
    });
  }, [features, zones, selectedZips, showLabels, toggleZip]);

  const assignedCount = useMemo(() => {
    const allZoned = new Set(zones.flatMap((z) => z.zips));
    return features.filter((f) => allZoned.has(f.properties?.zip)).length;
  }, [features, zones]);

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "24px 16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "#1a1a1a" }}>
        Service Zone Builder
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 340px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ===== LEFT: map + toolbar ===== */}
        <div>
          {/* Toolbar */}
          <div
            style={{
              marginBottom: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 13,
              color: "#444",
            }}
          >
            <button
              onClick={() => setShowInput((v) => !v)}
              style={{
                padding: "5px 12px",
                border: "1px solid #d3d1c7",
                borderRadius: 6,
                background: showInput ? "#1a1a1a" : "#fff",
                color: showInput ? "#fff" : "#1a1a1a",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {features.length ? `${features.length} zip${features.length === 1 ? "" : "s"} loaded` : "Load zips"}
            </button>

            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              Labels
            </label>

            {features.length > 0 && (
              <button
                onClick={resetZoom}
                style={{
                  padding: "5px 10px",
                  border: "1px solid #d3d1c7",
                  borderRadius: 6,
                  background: "#fff",
                  color: "#444",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Reset zoom
              </button>
            )}

            {features.length > 0 && (
              <span style={{ marginLeft: "auto", color: "#666" }}>
                {features.length} regions &middot; {assignedCount} assigned
              </span>
            )}
          </div>

          {/* Zip input panel */}
          {showInput && (
            <div
              style={{
                background: "#f7f5f0",
                border: "1px solid #e5e3dc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) loadZips();
                }}
                placeholder={"07302, 07306\n08037\n10001 10002"}
                rows={3}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  border: "1px solid #d3d1c7",
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: "monospace",
                  resize: "vertical",
                  background: "#fff",
                  outline: "none",
                  color: "#1a1a1a",
                }}
              />
              <button
                onClick={loadZips}
                disabled={fetching}
                style={{
                  padding: "8px 18px",
                  background: "#1a1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: fetching ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: fetching ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {fetching ? "Loading…" : "Show map"}
              </button>
            </div>
          )}

          {/* Map — wrapper gives the tooltip a positioning context */}
          <div style={{ position: "relative" }}>
            {/* D3 owns this div entirely — no React children inside */}
            <div
              ref={mapRef}
              style={{
                width: "100%",
                background: "#f7f5f0",
                borderRadius: 12,
                border: "1px solid #e5e3dc",
                overflow: "hidden",
                minHeight: features.length ? undefined : 420,
              }}
            />

            {/* Tooltip: sibling of map, positioned relative to wrapper */}
            <div ref={tooltipRef} />

            {/* Placeholder overlay — React-managed, never inside mapRef */}
            {!features.length && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  color: "#aaa",
                  fontSize: 14,
                }}
              >
                {fetching ? "Loading…" : "Enter zip codes above to load the map."}
              </div>
            )}
          </div>

          {notFound.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                background: "#fdf6ec",
                border: "1px solid #f0d9b0",
                borderRadius: 6,
                fontSize: 12,
                color: "#7a5c1e",
              }}
            >
              <strong>No boundary:</strong> {notFound.join(", ")} — PO Box or business-only zip
              codes with no geographic territory.
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
            Click a region to select it. Selected zips become available for assignment to a zone
            in the panel on the right. Locked zones cannot be changed.
          </div>
        </div>

        {/* ===== RIGHT: zone panel ===== */}
        <div
          style={{
            border: "1px solid #e5e3dc",
            borderRadius: 12,
            padding: 14,
            background: "#fff",
            fontSize: 13,
          }}
        >
          {/* Selection */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Selection</div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
              {selectedZips.size === 0
                ? "No zips selected — click regions on the map."
                : `${selectedZips.size} zip${selectedZips.size === 1 ? "" : "s"} selected`}
            </div>

            {selectedZips.size > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginBottom: 8,
                  maxHeight: 80,
                  overflowY: "auto",
                }}
              >
                {Array.from(selectedZips)
                  .sort()
                  .map((z) => (
                    <span
                      key={z}
                      onClick={() => toggleZip(z)}
                      style={{
                        background: "#f0eee6",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                        fontFamily: "monospace",
                      }}
                      title="Click to deselect"
                    >
                      {z} &times;
                    </span>
                  ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={assignSelection}
                disabled={!activeZoneId || !selectedZips.size}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: !activeZoneId || !selectedZips.size ? "#ccc" : "#1a1a1a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 5,
                  cursor: !activeZoneId || !selectedZips.size ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Assign to active zone
              </button>
              <button
                onClick={() => setSelectedZips(new Set())}
                disabled={!selectedZips.size}
                style={{
                  padding: "6px 10px",
                  background: "#fff",
                  border: "1px solid #d3d1c7",
                  borderRadius: 5,
                  cursor: !selectedZips.size ? "not-allowed" : "pointer",
                  fontSize: 12,
                  color: "#444",
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Zones header */}
          <div
            style={{
              borderTop: "1px solid #eee",
              paddingTop: 12,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "#1a1a1a",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Zones ({zones.length})
              {saveStatus !== "idle" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    color:
                      saveStatus === "saved"
                        ? "#1d9e75"
                        : saveStatus === "error"
                        ? "#a02525"
                        : "#888",
                  }}
                >
                  {saveStatus === "saving"
                    ? "Saving…"
                    : saveStatus === "saved"
                    ? "Saved"
                    : "Save failed"}
                </span>
              )}
            </div>
            <button
              onClick={createZone}
              style={{
                padding: "4px 10px",
                background: "#1a1a1a",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              + New zone
            </button>
          </div>

          {zones.length === 0 && (
            <div style={{ color: "#888", fontSize: 12, padding: "16px 0" }}>
              No zones yet. Create one, then click regions on the map and "Assign to active
              zone".
            </div>
          )}

          {/* Zone cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 520,
              overflowY: "auto",
            }}
          >
            {zones.map((z) => {
              const isActive = activeZoneId === z.id;
              return (
                <div
                  key={z.id}
                  onClick={() => !z.locked && setActiveZoneId(z.id)}
                  style={{
                    border: `2px solid ${isActive ? z.color : "#e5e3dc"}`,
                    borderRadius: 8,
                    padding: 8,
                    cursor: z.locked ? "default" : "pointer",
                    background: isActive ? z.color + "10" : "#fafaf7",
                  }}
                >
                  {/* Zone name row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: z.color,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    <input
                      value={z.name}
                      onChange={(e) => renameZone(z.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={z.locked}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#1a1a1a",
                        outline: "none",
                        cursor: z.locked ? "default" : "text",
                      }}
                    />
                    {isActive && !z.locked && (
                      <span
                        style={{ fontSize: 10, color: z.color, fontWeight: 600 }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Zip count */}
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                    {z.zips.length} zip{z.zips.length === 1 ? "" : "s"}
                  </div>

                  {/* Zip pills */}
                  {z.zips.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 3,
                        marginBottom: 6,
                        maxHeight: 70,
                        overflowY: "auto",
                      }}
                    >
                      {[...z.zips].sort().map((zip) => (
                        <span
                          key={zip}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!z.locked) removeFromZone(z.id, zip);
                          }}
                          style={{
                            background: "#fff",
                            border: `1px solid ${z.color}`,
                            color: z.color,
                            padding: "1px 5px",
                            borderRadius: 3,
                            fontSize: 10,
                            fontFamily: "monospace",
                            cursor: z.locked ? "default" : "pointer",
                          }}
                          title={z.locked ? "Zone is locked" : "Click to remove"}
                        >
                          {zip}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Zone actions */}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock(z.id);
                      }}
                      style={{
                        padding: "3px 8px",
                        background: z.locked ? z.color : "#fff",
                        color: z.locked ? "#fff" : "#555",
                        border: `1px solid ${z.locked ? z.color : "#d3d1c7"}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      {z.locked ? "Unlock" : "Lock"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyZips(z);
                      }}
                      style={{
                        padding: "3px 8px",
                        background: "#fff",
                        border: "1px solid #d3d1c7",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 11,
                        color: "#444",
                      }}
                    >
                      Copy zips
                    </button>
                    {!z.locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteZone(z.id);
                        }}
                        style={{
                          padding: "3px 8px",
                          background: "#fff",
                          color: "#bbb",
                          border: "1px solid #e5e3dc",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 11,
                          marginLeft: "auto",
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coverage footer */}
          {features.length > 0 && (
            <div
              style={{
                borderTop: "1px solid #eee",
                marginTop: 12,
                paddingTop: 10,
                fontSize: 12,
                color: "#666",
              }}
            >
              Coverage: {assignedCount} / {features.length} visible zip
              {features.length === 1 ? "" : "s"} assigned
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
