"use client";
import { useState, useEffect } from "react";

// ── Flag Reason Modal ─────────────────────────────────────────────────────────
function FlagModal({ batchId, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
            <span className="text-xl">🚩</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Flag Batch</h3>
            <p className="text-xs text-slate-400">
              Batch: {batchId?.slice(0, 20)}…
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-300 mb-4">
          Please provide a reason for flagging this batch. This will be recorded
          alongside the on-chain flag.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Damaged packaging observed upon delivery, suspected tampering..."
          rows={4}
          className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg py-2.5 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-medium rounded-lg py-2.5 transition-colors text-sm"
          >
            Confirm Flag
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function HospitalDashboard() {
  const [activeTab, setActiveTab] = useState("verify");

  // ── Register Manufacturer ─────────────────────────────────────────────────
  const [regForm, setRegForm] = useState({ userId: "", password: "" });
  const [regResult, setRegResult] = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  // ── Batch lookup & action ─────────────────────────────────────────────────
  const [batchId, setBatchId] = useState("");
  const [batchData, setBatchData] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  // ── Flag modal ────────────────────────────────────────────────────────────
  const [showFlagModal, setShowFlagModal] = useState(false);

  // ── All batches list + filter ─────────────────────────────────────────────
  const [allBatches, setAllBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | DELIVERED | VERIFIED | FLAGGED

  useEffect(() => {
    if (activeTab === "batches") loadAllBatches();
  }, [activeTab]);

  async function loadAllBatches() {
    setBatchesLoading(true);
    try {
      const res = await fetch("/api/hospital/flagged-batches");
      const data = await res.json();
      if (res.ok) setAllBatches(data.batches);
    } finally {
      setBatchesLoading(false);
    }
  }

  // Apply filter
  const filteredBatches =
    statusFilter === "ALL"
      ? allBatches
      : allBatches.filter((b) => b.status === statusFilter);

  // Counts for filter badges
  const counts = allBatches.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

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

  async function submitVerify() {
    setBatchLoading(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/hospital/batch-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: batchData.batchId, action: "verify" }),
      });
      const data = await res.json();
      setActionResult({ ok: res.ok, action: "verify", ...data });
      if (res.ok) lookupBatch();
    } finally {
      setBatchLoading(false);
    }
  }

  function initiateFlag() {
    setShowFlagModal(true);
  }

  async function confirmFlag(reason) {
    setShowFlagModal(false);
    setBatchLoading(true);
    setActionResult(null);
    try {
      const res = await fetch("/api/hospital/batch-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batchData.batchId,
          action: "flag",
          flagReason: reason,
        }),
      });
      const data = await res.json();
      setActionResult({ ok: res.ok, action: "flag", ...data });
      if (res.ok) lookupBatch();
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

  const flagReasonColor = {
    "Hospital Flagged": "bg-red-500/20 text-red-300 border-red-500/30",
    "Near Expiry": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    "Outside Registered Location":
      "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "Duplicate Location Update":
      "bg-purple-500/20 text-purple-300 border-purple-500/30",
    "Invalid Status Order": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  };

  const filterOptions = [
    { key: "ALL", label: "All", color: "bg-white/10 text-slate-300" },
    {
      key: "DELIVERED",
      label: "Delivered",
      color: "bg-green-500/20 text-green-300",
    },
    {
      key: "VERIFIED",
      label: "Verified",
      color: "bg-emerald-500/20 text-emerald-300",
    },
    { key: "FLAGGED", label: "Flagged", color: "bg-red-500/20 text-red-300" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showFlagModal && (
        <FlagModal
          batchId={batchData?.batchId}
          onConfirm={confirmFlag}
          onCancel={() => setShowFlagModal(false)}
        />
      )}

      <header className="border-b border-white/10 bg-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">H</span>
            </div>
            <span className="font-semibold">Hospital Portal</span>
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
            { key: "verify", label: "Verify / Flag Batch" },
            { key: "batches", label: "📋 View All Batches" },
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

        {/* ── Verify / Flag Tab ──────────────────────────────────────────────── */}
        {activeTab === "verify" && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">
                Look up Medicine Batch
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupBatch()}
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
              <div
                className={`rounded-xl p-4 text-sm ${actionResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}
              >
                {actionResult.ok ? (
                  <div>
                    <div>
                      {actionResult.action === "verify"
                        ? "✅ Batch verified on-chain"
                        : "🚩 Batch flagged on-chain"}
                    </div>
                    {actionResult.flagReason && (
                      <div className="text-xs mt-1 opacity-80">
                        Reason recorded: "{actionResult.flagReason}"
                      </div>
                    )}
                    <div className="text-xs mt-1 opacity-60">
                      tx: {actionResult.txHash?.slice(0, 24)}…
                    </div>
                  </div>
                ) : (
                  `❌ ${actionResult.error}`
                )}
              </div>
            )}

            {batchData && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    ["Batch ID", batchData.batchId?.slice(0, 18) + "…"],
                    ["Medicine", batchData.medicineName],
                    ["Medicine ID", batchData.medicineId],
                    ["Hospital", batchData.hospitalId],
                    ["Manufacturer", batchData.manufacturerId],
                    [
                      "Expiry",
                      new Date(batchData.expiryDate).toLocaleDateString(),
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-xs text-slate-400 mb-1">{k}</div>
                      <div className="text-sm font-medium truncate">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-slate-400">
                    Current Status:
                  </span>
                  <span
                    className={`${statusColor[batchData.currentStatus] || "bg-slate-600"} text-white text-xs font-bold px-3 py-1 rounded-full`}
                  >
                    {batchData.currentStatus}
                  </span>
                  {batchData.currentFlagReason !== "NONE" && (
                    <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                      {batchData.currentFlagReason.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {batchData.currentStatus === "DELIVERED" && (
                  <div className="flex gap-3">
                    <button
                      onClick={submitVerify}
                      disabled={batchLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                      ✅ Verify Batch
                    </button>
                    <button
                      onClick={initiateFlag}
                      disabled={batchLoading}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-50 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
                    >
                      🚩 Flag Batch
                    </button>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    Status History
                  </h3>
                  <div className="space-y-2">
                    {batchData.history?.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <span
                          className={`${statusColor[h.status] || "bg-slate-600"} text-white text-xs px-2 py-0.5 rounded-full mt-0.5 shrink-0`}
                        >
                          {h.status}
                        </span>
                        <div className="text-slate-300">
                          <span>{new Date(h.timestamp).toLocaleString()}</span>
                          {h.locationId && h.locationId !== "none" && (
                            <span className="text-slate-500 ml-2">
                              @ {h.locationId.slice(0, 12)}…
                            </span>
                          )}
                          {h.flagReason !== "NONE" && (
                            <span className="text-red-400 ml-2">
                              ⚠ {h.flagReason.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {batchData.images?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">
                      Proof Images
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {batchData.images.map((img, i) => (
                        <a
                          key={i}
                          href={`/api/images/${img.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-blue-300 hover:text-blue-200 transition-colors"
                        >
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

        {/* ── View All Batches Tab ───────────────────────────────────────────── */}
        {activeTab === "batches" && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold">All Batches</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Delivered, verified, and flagged batches assigned to your
                  hospital.
                </p>
              </div>
              <button
                onClick={loadAllBatches}
                disabled={batchesLoading}
                className="bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {batchesLoading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {filterOptions.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    statusFilter === key
                      ? `${color} border-current opacity-100`
                      : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {label}
                  {key !== "ALL" && counts[key] ? (
                    <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full">
                      {counts[key]}
                    </span>
                  ) : key === "ALL" ? (
                    <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full">
                      {allBatches.length}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* Loading */}
            {batchesLoading && (
              <div className="text-center py-12 text-slate-400">
                Loading batches…
              </div>
            )}

            {/* Empty state */}
            {!batchesLoading && filteredBatches.length === 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">📭</div>
                <div className="text-slate-300 font-medium">
                  {statusFilter === "ALL"
                    ? "No batches yet"
                    : `No ${statusFilter.toLowerCase()} batches`}
                </div>
                <div className="text-slate-500 text-sm mt-1">
                  {statusFilter !== "ALL" && (
                    <button
                      onClick={() => setStatusFilter("ALL")}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Show all batches
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Batch cards */}
            {!batchesLoading && filteredBatches.length > 0 && (
              <div className="space-y-3">
                {filteredBatches.map((batch) => (
                  <div
                    key={batch.batchId}
                    className={`bg-white/5 rounded-2xl p-5 border ${
                      batch.status === "FLAGGED"
                        ? "border-red-500/20"
                        : batch.status === "VERIFIED"
                          ? "border-emerald-500/20"
                          : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      {/* Left */}
                      <div className="space-y-2 min-w-0">
                        {/* Status + flag reason badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`${statusColor[batch.status]} text-white text-xs font-bold px-2.5 py-0.5 rounded-full`}
                          >
                            {batch.status}
                          </span>
                          {batch.flagReason && (
                            <span
                              className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${flagReasonColor[batch.flagReason] || "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}
                            >
                              {batch.flagReason}
                            </span>
                          )}
                        </div>

                        {/* Medicine info */}
                        <div>
                          <div className="font-semibold text-white">
                            {batch.medicineName}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Medicine ID: {batch.medicineId}
                          </div>
                        </div>

                        <div className="font-mono text-xs text-slate-500 break-all">
                          {batch.batchId}
                        </div>

                        {/* Hospital note (flagged only) */}
                        {batch.manualReason && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <div className="text-xs text-red-400 font-medium mb-0.5">
                              Hospital note:
                            </div>
                            <div className="text-sm text-red-300">
                              "{batch.manualReason}"
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: metadata */}
                      <div className="text-right text-xs text-slate-400 space-y-1 shrink-0">
                        <div>
                          Manufacturer:{" "}
                          <span className="text-white">
                            {batch.manufacturerId}
                          </span>
                        </div>
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
                        {batch.flaggedAt && (
                          <div>
                            Flagged:{" "}
                            <span className="text-red-300">
                              {new Date(batch.flaggedAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* View details link */}
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => {
                          setBatchId(batch.batchId);
                          setActiveTab("verify");
                          setTimeout(lookupBatch, 100);
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View full batch details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Register Manufacturer Tab ──────────────────────────────────────── */}
        {activeTab === "register" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              Register New Manufacturer
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Credentials will be bcrypt-hashed and stored on-chain.
            </p>

            {regResult && (
              <div
                className={`rounded-xl p-4 text-sm mb-4 ${regResult.ok ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}
              >
                {regResult.ok
                  ? `✅ Manufacturer registered — tx: ${regResult.txHash?.slice(0, 20)}…`
                  : `❌ ${regResult.error}`}
              </div>
            )}

            <form onSubmit={registerManufacturer} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Manufacturer User ID
                </label>
                <input
                  type="text"
                  value={regForm.userId}
                  onChange={(e) =>
                    setRegForm({ ...regForm, userId: e.target.value })
                  }
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. manufacturer_001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={regForm.password}
                  onChange={(e) =>
                    setRegForm({ ...regForm, password: e.target.value })
                  }
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
