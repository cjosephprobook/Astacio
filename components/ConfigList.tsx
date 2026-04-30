"use client";

import { useEffect, useState } from "react";

interface Config {
  id: string;
  name: string;
  zip_codes: string[];
  created_at: string;
}

export default function ConfigList() {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [zipInput, setZipInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/configs")
      .then((r) => r.json())
      .then(setConfigs)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const parseZips = (raw: string): string[] =>
    raw
      .split(/[\s,\n]+/)
      .map((z) => z.trim().padStart(5, "0"))
      .filter((z) => /^\d{5}$/.test(z));

  const create = async () => {
    setError("");
    const zip_codes = parseZips(zipInput);
    if (!name.trim()) return setError("Name is required.");
    if (!zip_codes.length) return setError("Enter at least one valid zip code.");

    setCreating(true);
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), zip_codes }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Failed to create config.");
      window.location.href = `/config/${data.id}`;
    } catch {
      setError("Network error.");
    } finally {
      setCreating(false);
    }
  };

  const deleteConfig = async (id: string, configName: string) => {
    if (!confirm(`Delete "${configName}"? This cannot be undone.`)) return;
    await fetch(`/api/configs/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: "8px 18px",
            background: "#333",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {showForm ? "Cancel" : "+ New config"}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            background: "#f7f5f0",
            border: "1px solid #e0ddd8",
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>New config</h3>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Jersey — North"
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #ccc",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
              Zip codes{" "}
              <span style={{ fontWeight: 400, color: "#888" }}>
                (comma, space, or newline separated)
              </span>
            </span>
            <textarea
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              placeholder={"07306, 07307, 07310\n07302\n10001 10002"}
              rows={6}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #ccc",
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "monospace",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
            <span style={{ fontSize: 12, color: "#888" }}>
              {parseZips(zipInput).length} valid zip codes detected
            </span>
          </label>

          {error && (
            <p style={{ margin: "0 0 10px", color: "#e15759", fontSize: 13 }}>{error}</p>
          )}

          <button
            onClick={create}
            disabled={creating}
            style={{
              padding: "8px 20px",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: creating ? "default" : "pointer",
              fontSize: 14,
            }}
          >
            {creating ? "Creating…" : "Create config"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : configs.length === 0 ? (
        <p style={{ color: "#888" }}>No configs yet. Create one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {configs.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: "#f7f5f0",
                border: "1px solid #e0ddd8",
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <a
                  href={`/config/${c.id}`}
                  style={{ fontSize: 15, fontWeight: 600, color: "#222", textDecoration: "none" }}
                >
                  {c.name}
                </a>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#888" }}>
                  {c.zip_codes.length} zip codes ·{" "}
                  {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <a
                href={`/config/${c.id}`}
                style={{
                  padding: "6px 14px",
                  background: "#333",
                  color: "#fff",
                  textDecoration: "none",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                Open
              </a>
              <button
                onClick={() => deleteConfig(c.id, c.name)}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  color: "#e15759",
                  border: "1px solid #e15759",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
