"use client";
import { useState, useRef, useEffect, useCallback } from "react";

const STATUS_LABELS = [
  "CREATED",
  "SHIPPED",
  "SORTED",
  "DELIVERED",
  "VERIFIED",
  "FLAGGED",
];
const NEXT_STATUS = { CREATED: 1, SHIPPED: 2, SORTED: 3 };

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

export default function ManufacturerDashboard() {
  const [activeTab, setActiveTab] = useState("batches");

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
      if (res.ok)
        setBatchForm({
          medicineId: "",
          medicineName: "",
          hospitalId: "",
          expiryDate: "",
        });
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

  async function lookupBatchForUpdate() {
    if (!updateBatchId.trim()) return;
    setBatchInfo(null);
    setUpdateResult(null);
    try {
      const res = await fetch(`/api/batch/${updateBatchId.trim()}`);
      const data = await res.json();
      setBatchInfo(res.ok ? data : { error: data.error });
    } catch (err) {
      setBatchInfo({ error: err.message });
    }
  }

  async function updateBatchStatus() {
    if (!batchInfo) return;
    if (!imageRef.current?.files[0]) {
      alert("Please attach an image proof before updating");
      return;
    }

    // ── Expiry check ──────────────────────────────────────────────────────────
    const expiryDate = new Date(batchInfo.expiryDate);
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    if (expiryDate <= oneMonthFromNow) {
      alert(
        "This batch cannot be updated — it expires within one month or has already expired.",
      );
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────
    const nextStatusCode = NEXT_STATUS[batchInfo.currentStatus];
    if (!nextStatusCode) {
      alert("No further status update possible");
      return;
    }

    setUpdateLoading(true);
    setUpdateResult(null);

    // Auto-detect GPS
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
      if (res.ok) lookupBatchForUpdate();
    } finally {
      setUpdateLoading(false);
    }
  }

  const statusColor = {
    CREATED: "bg-slate-500",
    SHIPPED: "bg-blue-500",
    SORTED: "bg-yellow-500",
    DELIVERED: "bg-green-500",
    VERIFIED: "bg-emerald-500",
    FLAGGED: "bg-red-500",
  };

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
            onClick={() => {
              document.cookie = "auth_token=; max-age=0";
              window.location.href = "/";
            }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-8 flex-wrap">
          {[
            { key: "batches", label: "Create Batch" },
            { key: "locations", label: "Register Location" },
            { key: "update", label: "Update Batch Status" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-violet-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Create Batch ──────────────────────────────────────────────────── */}
        {activeTab === "batches" && (
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

        {/* ── Update Batch Status ───────────────────────────────────────────── */}
        {activeTab === "update" && (
          <div className="max-w-lg">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  Update Batch Status
                </h2>
                <p className="text-sm text-slate-400">
                  Your GPS is detected automatically and matched against your
                  registered locations. Expiry is checked automatically.
                </p>
              </div>

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
                  onClick={lookupBatchForUpdate}
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
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Current Status
                    </span>
                    <span
                      className={`${statusColor[batchInfo.currentStatus]} text-white text-xs font-bold px-3 py-1 rounded-full`}
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
                        </label>
                        <input
                          type="file"
                          ref={imageRef}
                          required
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
                        : "✅ No further updates possible"}
                    </div>
                  )}
                </div>
              )}

              {updateResult && (
                <div
                  className={`rounded-xl p-4 text-sm ${updateResult.ok ? (updateResult.flagged ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-300" : "bg-green-500/20 border border-green-500/30 text-green-300") : "bg-red-500/20 border border-red-500/30 text-red-300"}`}
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
