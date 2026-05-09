"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const STATUS_LABELS = [
  "CREATED",
  "SHIPPED",
  "SORTED",
  "DISTRIBUTED",
  "DELIVERED",
  "VERIFIED",
  "FLAGGED",
];
const NEXT_STATUS = { CREATED: 1, SHIPPED: 2, SORTED: 3, DISTRIBUTED: 4 };

const statusColor = {
  CREATED: "bg-slate-500",
  SHIPPED: "bg-blue-500",
  SORTED: "bg-yellow-500",
  DISTRIBUTED: "bg-indigo-500",
  DELIVERED: "bg-green-500",
  VERIFIED: "bg-emerald-500",
  FLAGGED: "bg-red-500",
};

// ── Leaflet map picker ────────────────────────────────────────────────────────
function MapPicker({ onLocationSelect, selectedCoords }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const placeMarker = useCallback(
    (L, lat, lng, address) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
      }
      mapInstanceRef.current.setView([lat, lng], 15);
      onLocationSelect({ lat, lng, address });
    },
    [onLocationSelect],
  );

  async function searchLocation() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);

    // Strip lot/unit prefixes and clean up the query for Nominatim
    const cleaned = searchQuery
      .replace(/^(lot|no|unit|blok|block)[\s\d,.-]*/gi, "") // remove "Lot 8," etc
      .replace(/\b\d{5}\b/g, "") // remove postcodes
      .replace(/wilayah persekutuan/gi, "") // remove verbose admin terms
      .replace(/,\s*,/g, ",") // clean double commas
      .trim();

    const queries = [searchQuery, cleaned].filter(Boolean);

    try {
      let results = [];

      for (const q of queries) {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=my&addressdetails=1`,
        );
        const data = await res.json();
        if (data.length > 0) {
          results = data;
          break; // use first query that returns results
        }
      }

      if (results.length === 0) {
        setSearchResults([
          {
            place_id: "none",
            display_name: "No results found — try a landmark or area name",
            disabled: true,
          },
        ]);
      } else {
        setSearchResults(results);
      }
    } catch (err) {
      setSearchResults([
        {
          place_id: "error",
          display_name: `Search failed: ${err.message}`,
          disabled: true,
        },
      ]);
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result) {
    if (result.disabled) return; // ← add this
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    placeMarker(window.L, lat, lng, result.display_name);
    setSearchResults([]);
    setSearchQuery(result.display_name);
  }

  useEffect(() => {
    if (mapInstanceRef.current) return;

    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = window.L;

      if (mapRef.current._leaflet_id) {
        mapRef.current._leaflet_id = null;
      }
      const map = L.map(mapRef.current).setView([3.139, 101.6869], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        )
          .then((r) => r.json())
          .then((d) =>
            placeMarker(
              L,
              lat,
              lng,
              d.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            ),
          )
          .catch(() =>
            placeMarker(L, lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`),
          );
      });

      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [placeMarker]);

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchLocation()}
            placeholder="Search for road addresses or area names..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button
            type="button"
            onClick={searchLocation}
            disabled={searching}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm text-white transition-colors"
          >
            {searching ? "…" : "Search"}
          </button>
        </div>

        {/* Dropdown results */}
        {searchResults.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            {searchResults.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        style={{ height: "300px", borderRadius: "12px", zIndex: 0 }}
      />
      <p className="text-xs text-slate-400">
        📍 Search for a location above, or click anywhere on the map to pin it
      </p>
      {selectedCoords && (
        <div className="bg-white/5 rounded-lg px-3 py-2 text-xs text-green-400">
          Selected: {selectedCoords.lat.toFixed(6)},{" "}
          {selectedCoords.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function ManufacturerDashboard() {
  const [activeTab, setActiveTab] = useState("mybatches");

  // ── My Batches list + filter ──────────────────────────────────────────────
  const [myBatches, setMyBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // ── Create Batch ──────────────────────────────────────────────────────────
  const [batchForm, setBatchForm] = useState({
    medicineId: "",
    medicineName: "",
    hospitalId: "",
    expiryDate: "",
  });
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // ── Register Location ─────────────────────────────────────────────────────
  const [locForm, setLocForm] = useState({
    name: "",
    locationType: "FACTORY",
    address: "",
    latitude: null,
    longitude: null,
  });
  const [locResult, setLocResult] = useState(null);
  const [locLoading, setLocLoading] = useState(false);

  // ── Update Batch ──────────────────────────────────────────────────────────
  const [updateBatchId, setUpdateBatchId] = useState("");
  const [batchInfo, setBatchInfo] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const imageRef = useRef(null);

  const handleMapSelect = useCallback(({ lat, lng, address }) => {
    setLocForm((prev) => ({ ...prev, latitude: lat, longitude: lng, address }));
  }, []);

  // Load batches when tab opens
  useEffect(() => {
    if (activeTab === "mybatches") loadMyBatches();
  }, [activeTab]);

  async function loadMyBatches() {
    setBatchesLoading(true);
    try {
      const res = await fetch("/api/manufacturer/my-batches");
      const data = await res.json();
      if (res.ok) setMyBatches(data.batches);
    } finally {
      setBatchesLoading(false);
    }
  }

  // Filter batches
  const filteredBatches =
    statusFilter === "ALL"
      ? myBatches
      : myBatches.filter((b) => b.status === statusFilter);

  // Counts per status
  const counts = myBatches.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  // Navigate from batch card to update tab
  function openBatchForUpdate(batchId) {
    setUpdateBatchId(batchId);
    setActiveTab("update");
    setBatchInfo(null);
    setUpdateResult(null);
  }

  // Auto-lookup when switching to update tab with a pre-filled batchId
  useEffect(() => {
    if (activeTab === "update" && updateBatchId) {
      lookupBatchForUpdate(updateBatchId);
    }
  }, [activeTab]);

  async function createBatch(e) {
    e.preventDefault();
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await fetch("/api/manufacturer/create-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchForm),
      });
      const data = await res.json();
      setBatchResult({ ok: res.ok, ...data });
      if (res.ok) {
        setBatchForm({
          medicineId: "",
          medicineName: "",
          hospitalId: "",
          expiryDate: "",
        });
        loadMyBatches(); // refresh list
      }
    } finally {
      setBatchLoading(false);
    }
  }

  async function registerLocation(e) {
    e.preventDefault();
    if (!locForm.latitude || !locForm.longitude) {
      alert("Please pin a location on the map first");
      return;
    }
    setLocLoading(true);
    setLocResult(null);
    try {
      const res = await fetch("/api/manufacturer/register-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: locForm.name,
          locationType: locForm.locationType,
          address: locForm.address,
          latitude: locForm.latitude,
          longitude: locForm.longitude,
        }),
      });
      const data = await res.json();
      setLocResult({ ok: res.ok, ...data });
      if (res.ok)
        setLocForm({
          name: "",
          locationType: "FACTORY",
          address: "",
          latitude: null,
          longitude: null,
        });
    } finally {
      setLocLoading(false);
    }
  }

  async function lookupBatchForUpdate(id) {
    const bid = (id || updateBatchId).trim();
    if (!bid) return;
    setBatchInfo(null);
    setUpdateResult(null);
    try {
      const res = await fetch(`/api/batch/${bid}`);
      const data = await res.json();
      setBatchInfo(res.ok ? data : { error: data.error });
    } catch (err) {
      setBatchInfo({ error: err.message });
    }
  }

  async function updateBatchStatus() {
    if (!batchInfo) return;
    const nextStatusCode = NEXT_STATUS[batchInfo.currentStatus];
    if (!imageRef.current?.files[0]) {
      alert("Please attach an image proof before updating");
      return;
    }
    if (!nextStatusCode) {
      alert("No further status update possible");
      return;
    }

    setUpdateLoading(true);
    setUpdateResult(null);

    const coords = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 },
      );
    });

    const fd = new FormData();
    fd.append("batchId", updateBatchId.trim());
    fd.append("newStatus", nextStatusCode);
    fd.append("currentLat", coords?.lat ?? 0);
    fd.append("currentLng", coords?.lng ?? 0);
    fd.append("geoAvailable", coords ? "true" : "false");
    if (imageRef.current?.files[0])
      fd.append("imageProof", imageRef.current.files[0]);

    try {
      const res = await fetch("/api/manufacturer/update-batch", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      setUpdateResult({ ok: res.ok, ...data });
      if (res.ok) {
        lookupBatchForUpdate(updateBatchId);
        loadMyBatches(); // keep list in sync
      }
    } finally {
      setUpdateLoading(false);
    }
  }

  const filterOptions = [
    { key: "ALL", label: "All" },
    { key: "CREATED", label: "Created" },
    { key: "SHIPPED", label: "Shipped" },
    { key: "SORTED", label: "Sorted" },
    { key: "DISTRIBUTED", label: "Distributed" },
    { key: "DELIVERED", label: "Delivered" },
    { key: "VERIFIED", label: "Verified" },
    { key: "FLAGGED", label: "Flagged" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">M</span>
            </div>
            <span className="font-semibold">Manufacturer Portal</span>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/";
            }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {[
            { key: "mybatches", label: "📋 My Batches" },
            { key: "create", label: "Create Batch" },
            { key: "locations", label: "Register Location" },
            { key: "update", label: "Update Batch Status" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-violet-500 text-white"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── My Batches Tab ─────────────────────────────────────────────────── */}
        {activeTab === "mybatches" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold">My Batches</h2>
                <p className="text-sm text-slate-400 mt-1">
                  All medicine batches created by your account.
                </p>
              </div>
              <button
                onClick={loadMyBatches}
                disabled={batchesLoading}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {batchesLoading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {filterOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === key
                      ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                      : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full">
                    {key === "ALL" ? myBatches.length : counts[key] || 0}
                  </span>
                </button>
              ))}
            </div>

            {batchesLoading && (
              <div className="text-center py-12 text-slate-400">
                Loading batches…
              </div>
            )}

            {!batchesLoading && filteredBatches.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <div className="text-slate-300 font-medium">
                  {statusFilter === "ALL"
                    ? "No batches yet"
                    : `No ${statusFilter.toLowerCase()} batches`}
                </div>
                {statusFilter !== "ALL" && (
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className="text-violet-400 hover:text-violet-300 text-sm mt-2 transition-colors"
                  >
                    Show all batches
                  </button>
                )}
              </div>
            )}

            {!batchesLoading && filteredBatches.length > 0 && (
              <div className="space-y-3">
                {filteredBatches.map((batch) => (
                  <div
                    key={batch.batchId}
                    className={`bg-white/5 rounded-2xl p-5 border transition-colors ${
                      batch.status === "FLAGGED"
                        ? "border-red-500/20"
                        : batch.status === "VERIFIED"
                          ? "border-emerald-500/20"
                          : batch.status === "DELIVERED"
                            ? "border-green-500/20"
                            : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Left */}
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`${statusColor[batch.status]} text-white text-xs font-bold px-2.5 py-0.5 rounded-full`}
                          >
                            {batch.status}
                          </span>
                          {batch.flagReason && (
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/30">
                              {batch.flagReason}
                            </span>
                          )}
                          {NEXT_STATUS[batch.status] && (
                            <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                              → {STATUS_LABELS[NEXT_STATUS[batch.status]]}{" "}
                              pending
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-white">
                            {batch.medicineName}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Medicine ID: {batch.medicineId}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Hospital: {batch.hospitalId}
                          </div>
                        </div>

                        <div className="font-mono text-xs text-slate-500 break-all">
                          {batch.batchId}
                        </div>
                      </div>

                      {/* Right: metadata */}
                      <div className="text-right text-xs text-slate-400 space-y-1 shrink-0">
                        <div>
                          Expiry:{" "}
                          <span className="text-white">
                            {new Date(batch.expiryDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          Created:{" "}
                          <span className="text-white">
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      {NEXT_STATUS[batch.status] ? (
                        <button
                          onClick={() => openBatchForUpdate(batch.batchId)}
                          className="bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                        >
                          Update to {STATUS_LABELS[NEXT_STATUS[batch.status]]} →
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {batch.status === "DELIVERED"
                            ? "⏳ Awaiting hospital action"
                            : "✅ Complete"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Create Batch Tab ───────────────────────────────────────────────── */}
        {activeTab === "create" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
            <h2 className="text-lg font-semibold mb-2">
              Create New Medicine Batch
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Batch ID is generated via keccak256 hash and stored on-chain.
            </p>

            {batchResult && (
              <div
                className={`rounded-xl p-4 text-sm mb-4 ${batchResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}
              >
                {batchResult.ok ? (
                  <div>
                    <div>✅ Batch created on-chain</div>
                    <div className="font-mono text-xs mt-1 break-all">
                      ID: {batchResult.batchId}
                    </div>
                    <div className="text-xs mt-1 opacity-60">
                      tx: {batchResult.txHash}
                    </div>
                  </div>
                ) : (
                  `❌ ${batchResult.error}`
                )}
              </div>
            )}

            <form onSubmit={createBatch} className="space-y-4">
              {[
                ["Medicine ID", "medicineId", "e.g. MED-12345"],
                ["Medicine Name", "medicineName", "e.g. Paracetamol 500mg"],
                ["Hospital ID", "hospitalId", "Destination hospital user ID"],
              ].map(([label, key, ph]) => (
                <div key={key}>
                  <label className="block text-sm text-slate-300 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={batchForm[key]}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, [key]: e.target.value })
                    }
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder={ph}
                    required
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Expiry Date
                </label>
                <input
                  type="date"
                  value={batchForm.expiryDate}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, expiryDate: e.target.value })
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={batchLoading}
                className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                {batchLoading ? "Creating on-chain…" : "Create Batch"}
              </button>
            </form>
          </div>
        )}

        {/* ── Register Location ─────────────────────────────────────────────── */}
        {activeTab === "locations" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl">
            <h2 className="text-lg font-semibold mb-2">
              Register Verified Location
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Pin your location on the map — coordinates and address are
              extracted automatically.
            </p>
            {locResult && (
              <div
                className={`rounded-xl p-4 text-sm mb-4 ${locResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}
              >
                {locResult.ok ? (
                  <div>
                    <div>✅ Location registered on-chain</div>
                    <div className="text-xs mt-1">
                      ID:{" "}
                      <span className="font-mono">{locResult.locationId}</span>
                    </div>
                    <div className="font-mono text-xs mt-1 break-all opacity-60">
                      Hash: {locResult.locationDataHash}
                    </div>
                  </div>
                ) : (
                  `❌ ${locResult.error}`
                )}
              </div>
            )}
            <form onSubmit={registerLocation} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Location Name
                  </label>
                  <input
                    type="text"
                    value={locForm.name}
                    onChange={(e) =>
                      setLocForm({ ...locForm, name: e.target.value })
                    }
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="e.g. Main Factory KL"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Location Type
                  </label>
                  <select
                    value={locForm.locationType}
                    onChange={(e) =>
                      setLocForm({ ...locForm, locationType: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="FACTORY">Factory</option>
                    <option value="DISTRIBUTION_CENTER">
                      Distribution Center
                    </option>
                    <option value="SORTING_CENTER">Sorting Center</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Pin Location on Map
                </label>
                <MapPicker
                  onLocationSelect={handleMapSelect}
                  selectedCoords={
                    locForm.latitude
                      ? { lat: locForm.latitude, lng: locForm.longitude }
                      : null
                  }
                />
              </div>

              {locForm.address && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1">
                    Address (auto-detected)
                  </label>
                  <div className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-slate-300 text-sm leading-relaxed">
                    {locForm.address}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={locLoading || !locForm.latitude}
                className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                {locLoading
                  ? "Registering on-chain…"
                  : !locForm.latitude
                    ? "📍 Pin a location on the map first"
                    : "Register Location"}
              </button>
            </form>
          </div>
        )}
        {/* ── Update Batch Status Tab ────────────────────────────────────────── */}
        {activeTab === "update" && (
          <div className="max-w-lg">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab("mybatches")}
                  className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                  ← Back to My Batches
                </button>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-1">
                  Update Batch Status
                </h2>
                <p className="text-sm text-slate-400">
                  GPS is detected automatically and matched against your
                  registered locations.
                </p>
              </div>

              {/* Batch ID input */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={updateBatchId}
                  onChange={(e) => {
                    setUpdateBatchId(e.target.value);
                    setBatchInfo(null);
                    setUpdateResult(null);
                  }}
                  placeholder="Batch ID (0x...)"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <button
                  onClick={() => lookupBatchForUpdate(updateBatchId)}
                  className="bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-lg text-sm transition-colors"
                >
                  Look up
                </button>
              </div>

              {batchInfo?.error && (
                <p className="text-red-400 text-sm">❌ {batchInfo.error}</p>
              )}

              {batchInfo && !batchInfo.error && (
                <div className="bg-white/5 rounded-xl p-4 space-y-4">
                  {/* Batch summary */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400 text-xs block">
                        Medicine
                      </span>
                      <span className="font-medium">
                        {batchInfo.medicineName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">
                        Expiry Date
                      </span>
                      <span className="font-medium">
                        {new Date(batchInfo.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">
                        Hospital
                      </span>
                      <span className="font-medium">
                        {batchInfo.hospitalId}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">
                        Medicine ID
                      </span>
                      <span className="font-medium">
                        {batchInfo.medicineId}
                      </span>
                    </div>
                  </div>

                  {/* Current status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Current Status
                    </span>
                    <span
                      className={`${statusColor[batchInfo.currentStatus] || "bg-slate-600"} text-white text-xs font-bold px-3 py-1 rounded-full`}
                    >
                      {batchInfo.currentStatus}
                    </span>
                  </div>

                  {NEXT_STATUS[batchInfo.currentStatus] ? (
                    <>
                      <div className="text-xs bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 space-y-1 text-slate-300">
                        <div>
                          🔜 Next:{" "}
                          <strong className="text-white">
                            {
                              STATUS_LABELS[
                                NEXT_STATUS[batchInfo.currentStatus]
                              ]
                            }
                          </strong>
                        </div>
                        <div className="text-slate-400">
                          📍 GPS will be matched against your registered
                          locations automatically
                        </div>
                        <div className="text-slate-400">
                          📅 Expiry date will be checked automatically
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-300 mb-1">
                          Image Proof{" "}
                          <span className="text-slate-500 text-xs">
                            (optional)
                          </span>
                        </label>
                        <input
                          type="file"
                          ref={imageRef}
                          accept="image/*"
                          className="w-full text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:cursor-pointer"
                        />
                      </div>

                      <button
                        onClick={updateBatchStatus}
                        disabled={updateLoading}
                        className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg py-3 transition-colors"
                      >
                        {updateLoading
                          ? "📍 Detecting location & submitting…"
                          : `Update to ${STATUS_LABELS[NEXT_STATUS[batchInfo.currentStatus]]}`}
                      </button>
                    </>
                  ) : (
                    <div className="text-sm text-slate-400 text-center py-2">
                      {batchInfo.currentStatus === "DELIVERED"
                        ? "⏳ Awaiting hospital verification"
                        : batchInfo.currentStatus === "FLAGGED"
                          ? "⚠️ Batch has been flagged"
                          : "✅ No further updates possible"}
                    </div>
                  )}
                </div>
              )}

              {/* Update result */}
              {updateResult && (
                <div
                  className={`rounded-xl p-4 text-sm ${
                    updateResult.ok
                      ? updateResult.flagged
                        ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-300"
                        : "bg-green-500/20 border border-green-500/30 text-green-300"
                      : "bg-red-500/20 border border-red-500/30 text-red-300"
                  }`}
                >
                  {updateResult.ok ? (
                    <div className="space-y-1">
                      {updateResult.flagged ? (
                        <>
                          <div>
                            ⚠️ Stored but <strong>FLAGGED</strong>
                          </div>
                          <div className="text-xs">
                            Reason: {updateResult.flagReasonLabel}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>✅ Status updated on-chain</div>
                          <div className="text-xs">
                            Matched location:{" "}
                            <span className="font-mono">
                              {updateResult.matchedLocationId}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="text-xs opacity-60">
                        tx: {updateResult.txHash?.slice(0, 24)}…
                      </div>
                    </div>
                  ) : (
                    `❌ ${updateResult.error}`
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
