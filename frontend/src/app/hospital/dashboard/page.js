"use client";
import { useState } from "react";

export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState("verify");

  // ── Register Manufacturer state ───────────────────────────────────────────
  const [regForm, setRegForm] = useState({ userId: "", password: "" });
  const [regResult, setRegResult] = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  // ── Batch action state ────────────────────────────────────────────────────
  const [batchId, setBatchId] = useState("");
  const [batchData, setBatchData] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  async function registerManufacturer(e) {
    e.preventDefault();
    setRegLoading(true);
    setRegResult(null);
    try {
      const res = await fetch("/api/hospital/register-manufacturer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      setRegResult({ ok: res.ok, ...data });
    } finally {
      setRegLoading(false);
    }
  }

  async function lookupBatch() {
    if (!batchId.trim()) return;
    setBatchLoading(true);
    setBatchData(null);
    setActionResult(null);
    try {
      const res = await fetch(`/api/batch/${batchId.trim()}`);
      const data = await res.json();
      if (res.ok) setBatchData(data);
      else setActionResult({ ok: false, error: data.error });
    } finally {
      setBatchLoading(false);
    }
  }

  async function submitBatchAction(action) {
    setBatchLoading(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/hospital/batch-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: batchData.batchId, action }),
      });
      const data = await res.json();
      setActionResult({ ok: res.ok, action, ...data });
      if (res.ok) lookupBatch(); // refresh
    } finally {
      setBatchLoading(false);
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
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">H</span>
            </div>
            <span className="font-semibold">Hospital Portal</span>
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
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {[
            { key: "verify", label: "Verify / Flag Batch" },
            { key: "register", label: "Register Manufacturer" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-blue-500 text-white"
                  : "bg-white/10 text-slate-300 hover:bg-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Verify / Flag Tab ─────────────────────────────────────────────── */}
        {activeTab === "verify" && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Look up Medicine Batch</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="Enter Batch ID (0x...)"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={lookupBatch}
                  disabled={batchLoading}
                  className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                  {batchLoading ? "Loading…" : "Search"}
                </button>
              </div>
            </div>

            {actionResult && (
              <div className={`rounded-xl p-4 text-sm ${actionResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
                {actionResult.ok
                  ? `✅ Batch ${actionResult.action === "verify" ? "verified" : "flagged"} — tx: ${actionResult.txHash?.slice(0, 20)}…`
                  : `❌ ${actionResult.error}`}
              </div>
            )}

            {batchData && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                {/* Batch info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    ["Batch ID", batchData.batchId?.slice(0, 18) + "…"],
                    ["Medicine", batchData.medicineName],
                    ["Medicine ID", batchData.medicineId],
                    ["Hospital", batchData.hospitalId],
                    ["Manufacturer", batchData.manufacturerId],
                    ["Expiry", new Date(batchData.expiryDate).toLocaleDateString()],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-xs text-slate-400 mb-1">{k}</div>
                      <div className="text-sm font-medium truncate">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Current status badge */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">Current Status:</span>
                  <span className={`${statusColor[batchData.currentStatus] || "bg-slate-600"} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                    {batchData.currentStatus}
                  </span>
                  {batchData.currentFlagReason !== "NONE" && (
                    <span className="text-xs text-red-400">({batchData.currentFlagReason.replace(/_/g, " ")})</span>
                  )}
                </div>

                {/* Action buttons */}
                {batchData.currentStatus === "DELIVERED" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => submitBatchAction("verify")}
                      disabled={batchLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                      ✅ Verify Batch
                    </button>
                    <button
                      onClick={() => submitBatchAction("flag")}
                      disabled={batchLoading}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-6 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                      🚩 Flag Batch
                    </button>
                  </div>
                )}

                {/* History timeline */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Status History</h3>
                  <div className="space-y-2">
                    {batchData.history?.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <span className={`${statusColor[h.status] || "bg-slate-600"} text-white text-xs px-2 py-0.5 rounded-full mt-0.5 shrink-0`}>
                          {h.status}
                        </span>
                        <div className="text-slate-300">
                          {new Date(h.timestamp).toLocaleString()}
                          {h.locationId && <span className="text-slate-500 ml-2">@ {h.locationId.slice(0, 12)}…</span>}
                          {h.flagReason !== "NONE" && (
                            <span className="text-red-400 ml-2">⚠ {h.flagReason.replace(/_/g, " ")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Images */}
                {batchData.images?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Proof Images</h3>
                    <div className="flex flex-wrap gap-3">
                      {batchData.images.map((img, i) => (
                        <a key={i} href={img.image_path} target="_blank" rel="noopener noreferrer"
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-blue-300 hover:text-blue-200">
                          Image #{i + 1} (step {img.status_step})
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Register Manufacturer Tab ──────────────────────────────────────── */}
        {activeTab === "register" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-md">
            <h2 className="text-lg font-semibold mb-4">Register New Manufacturer</h2>
            <p className="text-sm text-slate-400 mb-6">
              Credentials will be bcrypt-hashed and stored on-chain.
            </p>

            {regResult && (
              <div className={`rounded-xl p-4 text-sm mb-4 ${regResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
                {regResult.ok ? `✅ Manufacturer registered — tx: ${regResult.txHash?.slice(0, 20)}…` : `❌ ${regResult.error}`}
              </div>
            )}

            <form onSubmit={registerManufacturer} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Manufacturer User ID</label>
                <input
                  type="text"
                  value={regForm.userId}
                  onChange={(e) => setRegForm({ ...regForm, userId: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. manufacturer_001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Assign a password"
                  required
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                disabled={regLoading}
                className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 transition-colors"
              >
                {regLoading ? "Registering on-chain…" : "Register Manufacturer"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
