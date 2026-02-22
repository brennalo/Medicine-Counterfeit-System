"use client";
import { useState, useRef } from "react";

const STATUS_LABELS = ["CREATED", "SHIPPED", "SORTED", "DELIVERED", "VERIFIED", "FLAGGED"];
const NEXT_STATUS = { CREATED: 1, SHIPPED: 2, SORTED: 3 }; // DELIVERED is handled by hospital

export default function ManufacturerDashboard() {
  const [activeTab, setActiveTab] = useState("batches");

  // ── Create Batch ──────────────────────────────────────────────────────────
  const [batchForm, setBatchForm] = useState({
    medicineId: "", medicineName: "", hospitalId: "", expiryDate: ""
  });
  const [batchResult, setBatchResult] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // ── Register Location ─────────────────────────────────────────────────────
  const [locForm, setLocForm] = useState({
    name: "", locationType: "FACTORY", address: "", latitude: "", longitude: ""
  });
  const [locResult, setLocResult] = useState(null);
  const [locLoading, setLocLoading] = useState(false);

  // ── Update Batch ──────────────────────────────────────────────────────────
  const [updateBatchId, setUpdateBatchId] = useState("");
  const [updateLocationId, setUpdateLocationId] = useState("");
  const [batchInfo, setBatchInfo] = useState(null);
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const imageRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
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
      if (res.ok) setBatchForm({ medicineId: "", medicineName: "", hospitalId: "", expiryDate: "" });
    } finally {
      setBatchLoading(false);
    }
  }

  async function registerLocation(e) {
    e.preventDefault();
    setLocLoading(true);
    setLocResult(null);
    try {
      const res = await fetch("/api/manufacturer/register-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...locForm,
          latitude: parseFloat(locForm.latitude),
          longitude: parseFloat(locForm.longitude),
        }),
      });
      const data = await res.json();
      setLocResult({ ok: res.ok, ...data });
    } finally {
      setLocLoading(false);
    }
  }

  async function lookupBatchForUpdate() {
    if (!updateBatchId.trim()) return;
    try {
      const res = await fetch(`/api/batch/${updateBatchId.trim()}`);
      const data = await res.json();
      if (res.ok) setBatchInfo(data);
      else setBatchInfo({ error: data.error });
    } catch (err) {
      setBatchInfo({ error: err.message });
    }
  }

  function getGeolocation() {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        alert("Geolocation denied or unavailable");
      }
    );
  }

  async function updateBatchStatus() {
    if (!batchInfo || !updateLocationId || !geoCoords) {
      alert("Please fill all fields and get geolocation");
      return;
    }
    setUpdateLoading(true);
    setUpdateResult(null);

    const nextStatusCode = NEXT_STATUS[batchInfo.currentStatus];
    if (!nextStatusCode) {
      alert("No further status update possible");
      setUpdateLoading(false);
      return;
    }

    const fd = new FormData();
    fd.append("batchId", updateBatchId.trim());
    fd.append("newStatus", nextStatusCode);
    fd.append("locationId", updateLocationId);
    fd.append("currentLat", geoCoords.lat);
    fd.append("currentLng", geoCoords.lng);
    if (imageRef.current?.files[0]) fd.append("imageProof", imageRef.current.files[0]);

    try {
      const res = await fetch("/api/manufacturer/update-batch", { method: "POST", body: fd });
      const data = await res.json();
      setUpdateResult({ ok: res.ok, ...data });
      if (res.ok) lookupBatchForUpdate();
    } finally {
      setUpdateLoading(false);
    }
  }

  const statusColor = {
    CREATED: "bg-slate-500", SHIPPED: "bg-blue-500", SORTED: "bg-yellow-500",
    DELIVERED: "bg-green-500", VERIFIED: "bg-emerald-500", FLAGGED: "bg-red-500",
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
            onClick={() => { document.cookie = "auth_token=; max-age=0"; window.location.href = "/"; }}
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
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-violet-500 text-white" : "bg-white/10 text-slate-300 hover:bg-white/20"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Create Batch ──────────────────────────────────────────────────── */}
        {activeTab === "batches" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
            <h2 className="text-lg font-semibold mb-2">Create New Medicine Batch</h2>
            <p className="text-sm text-slate-400 mb-6">Batch ID will be generated via keccak256 hash and stored on-chain.</p>

            {batchResult && (
              <div className={`rounded-xl p-4 text-sm mb-4 ${batchResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
                {batchResult.ok ? (
                  <div>
                    <div>✅ Batch created on-chain</div>
                    <div className="font-mono text-xs mt-1 break-all">Batch ID: {batchResult.batchId}</div>
                    <div className="text-xs mt-1 text-green-400/70">tx: {batchResult.txHash}</div>
                  </div>
                ) : `❌ ${batchResult.error}`}
              </div>
            )}

            <form onSubmit={createBatch} className="space-y-4">
              {[
                ["Medicine ID", "medicineId", "e.g. MED-12345"],
                ["Medicine Name", "medicineName", "e.g. Paracetamol 500mg"],
                ["Hospital ID", "hospitalId", "Destination hospital ID"],
              ].map(([label, key, ph]) => (
                <div key={key}>
                  <label className="block text-sm text-slate-300 mb-1">{label}</label>
                  <input type="text" value={batchForm[key]}
                    onChange={(e) => setBatchForm({ ...batchForm, [key]: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder={ph} required />
                </div>
              ))}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Expiry Date</label>
                <input type="date" value={batchForm.expiryDate}
                  onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  required />
              </div>
              <button type="submit" disabled={batchLoading}
                className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors">
                {batchLoading ? "Creating on-chain…" : "Create Batch"}
              </button>
            </form>
          </div>
        )}

        {/* ── Register Location ─────────────────────────────────────────────── */}
        {activeTab === "locations" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
            <h2 className="text-lg font-semibold mb-2">Register Verified Location</h2>
            <p className="text-sm text-slate-400 mb-6">Address & coordinates saved off-chain (MySQL). A keccak256 hash commitment is stored on-chain.</p>

            {locResult && (
              <div className={`rounded-xl p-4 text-sm mb-4 ${locResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
                {locResult.ok ? (
                  <div>
                    <div>✅ Location registered</div>
                    <div className="text-xs mt-1">ID: {locResult.locationId}</div>
                    <div className="font-mono text-xs mt-1 break-all">Hash: {locResult.locationDataHash}</div>
                  </div>
                ) : `❌ ${locResult.error}`}
              </div>
            )}

            <form onSubmit={registerLocation} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Location Name</label>
                <input type="text" value={locForm.name}
                  onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="e.g. Main Factory KL" required />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Location Type</label>
                <select value={locForm.locationType}
                  onChange={(e) => setLocForm({ ...locForm, locationType: e.target.value })}
                  className="w-full bg-slate-800 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="FACTORY">Factory</option>
                  <option value="DISTRIBUTION_CENTER">Distribution Center</option>
                  <option value="SORTING_CENTER">Sorting Center</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Address</label>
                <input type="text" value={locForm.address}
                  onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="Full street address" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["latitude", "longitude"].map((coord) => (
                  <div key={coord}>
                    <label className="block text-sm text-slate-300 mb-1 capitalize">{coord}</label>
                    <input type="number" step="any" value={locForm[coord]}
                      onChange={(e) => setLocForm({ ...locForm, [coord]: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      placeholder={coord === "latitude" ? "4.2105" : "108.9758"} required />
                  </div>
                ))}
              </div>
              <button type="submit" disabled={locLoading}
                className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors">
                {locLoading ? "Registering…" : "Register Location"}
              </button>
            </form>
          </div>
        )}

        {/* ── Update Batch Status ───────────────────────────────────────────── */}
        {activeTab === "update" && (
          <div className="space-y-6 max-w-lg">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Update Batch Status</h2>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <input type="text" value={updateBatchId}
                    onChange={(e) => { setUpdateBatchId(e.target.value); setBatchInfo(null); }}
                    placeholder="Batch ID (0x...)"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  <button onClick={lookupBatchForUpdate}
                    className="bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-lg text-sm transition-colors">
                    Look up
                  </button>
                </div>

                {batchInfo?.error && <p className="text-red-400 text-sm">❌ {batchInfo.error}</p>}

                {batchInfo && !batchInfo.error && (
                  <div className="bg-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Current Status</span>
                      <span className={`${statusColor[batchInfo.currentStatus]} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                        {batchInfo.currentStatus}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Next step: <strong className="text-white">{STATUS_LABELS[NEXT_STATUS[batchInfo.currentStatus]] || "N/A"}</strong>
                    </div>
                    {NEXT_STATUS[batchInfo.currentStatus] && (
                      <>
                        <div>
                          <label className="block text-sm text-slate-300 mb-1">Location ID</label>
                          <input type="text" value={updateLocationId}
                            onChange={(e) => setUpdateLocationId(e.target.value)}
                            placeholder="Registered location ID"
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                        </div>

                        <div>
                          <label className="block text-sm text-slate-300 mb-1">Geolocation</label>
                          <div className="flex items-center gap-3">
                            <button onClick={getGeolocation} disabled={geoLoading}
                              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors">
                              {geoLoading ? "Getting location…" : "📍 Get My Location"}
                            </button>
                            {geoCoords && (
                              <span className="text-xs text-green-400">
                                {geoCoords.lat.toFixed(5)}, {geoCoords.lng.toFixed(5)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm text-slate-300 mb-1">Image Proof</label>
                          <input type="file" ref={imageRef} accept="image/*"
                            className="w-full text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white file:cursor-pointer" />
                        </div>

                        <button onClick={updateBatchStatus} disabled={updateLoading || !geoCoords}
                          className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors text-sm">
                          {updateLoading ? "Submitting to blockchain…" : `Update to ${STATUS_LABELS[NEXT_STATUS[batchInfo.currentStatus]]}`}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {updateResult && (
                  <div className={`rounded-xl p-4 text-sm ${updateResult.ok ? (updateResult.flagged ? "bg-yellow-500/20 border border-yellow-500/30 text-yellow-300" : "bg-green-500/20 border border-green-500/30 text-green-300") : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
                    {updateResult.ok ? (
                      updateResult.flagged
                        ? `⚠️ Update stored but FLAGGED: ${(updateResult.flagReason ? ["", "Near Expiry", "Outside Registered Location", "Duplicate Location Update", "Invalid Status Order", "Hospital Flagged"][parseInt(updateResult.flagReason)] : "Unknown")}`
                        : `✅ Status updated on-chain — tx: ${updateResult.txHash?.slice(0, 20)}…`
                    ) : `❌ ${updateResult.error}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
