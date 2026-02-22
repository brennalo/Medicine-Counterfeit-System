// frontend/app/api/hospital/batch-action/route.js
import { NextResponse } from "next/server";
import { getMedicineRegistry } from "@/lib/blockchain";
import { withAuth } from "@/lib/auth";

/**
 * POST body: { batchId, action: "verify" | "flag" }
 */
async function handler(request) {
  try {
    const { batchId, action } = await request.json();

    if (!batchId || !action) {
      return NextResponse.json({ error: "batchId and action required" }, { status: 400 });
    }

    if (!["verify", "flag"].includes(action)) {
      return NextResponse.json({ error: 'action must be "verify" or "flag"' }, { status: 400 });
    }

    const hospitalId = request.user.userId;
    const registry = getMedicineRegistry();

    // Check batch exists
    const batchExists = await registry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    let tx;
    if (action === "verify") {
      tx = await registry.verifyBatch(batchId, hospitalId);
    } else {
      tx = await registry.flagBatch(batchId, hospitalId);
    }

    await tx.wait();

    return NextResponse.json({
      success: true,
      batchId,
      action,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Batch Action]", err);
    // Surface revert reasons
    const msg = err?.revert?.args?.[0] || err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withAuth(handler, "HOSPITAL");
