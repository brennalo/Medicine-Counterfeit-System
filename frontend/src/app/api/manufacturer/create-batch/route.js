// frontend/app/api/manufacturer/create-batch/route.js
import { NextResponse } from "next/server";
import {
  getMedicineRegistry,
  generateBatchId,
  getUserRegistry,
  hashBatchData,
} from "@/lib/blockchain";
import { withAuth } from "@/lib/auth";

/**
 * POST body: {
 *   medicineId, medicineName, hospitalId, expiryDate (ISO string)
 * }
 */
async function handler(request) {
  try {
    const { medicineId, medicineName, hospitalId, expiryDate } =
      await request.json();

    if (!medicineId || !medicineName || !hospitalId || !expiryDate) {
      return NextResponse.json(
        { error: "All fields required" },
        { status: 400 },
      );
    }

    const manufacturerId = request.user.userId;
    const expiryTimestamp = Math.floor(new Date(expiryDate).getTime() / 1000);

    if (expiryTimestamp <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: "Expiry date must be in the future" },
        { status: 400 },
      );
    }

    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    if (new Date(expiryDate) <= oneMonthFromNow) {
      return NextResponse.json(
        { error: "Expiry date must be more than one month from today" },
        { status: 400 },
      );
    }

    // ── Validate hospital exists on-chain ─────────────────────────────────
    const userRegistry = getUserRegistry();
    const hospitalExists = await userRegistry.userExists(hospitalId);
    if (!hospitalExists) {
      return NextResponse.json(
        { error: "Hospital ID does not exist" },
        { status: 400 },
      );
    }
    const hospitalRole = await userRegistry.getUserRole(hospitalId);
    if (Number(hospitalRole) !== 1) {
      return NextResponse.json(
        { error: "Provided ID is not a hospital" },
        { status: 400 },
      );
    }

    // Generate batch ID (deterministic hash)
    const batchIdBytes32 = generateBatchId(
      medicineId,
      manufacturerId,
      hospitalId,
      expiryTimestamp,
    );

    // Store as hex string on-chain
    const batchId = batchIdBytes32;

    const batchDataHash = hashBatchData(
      medicineId,
      medicineName,
      hospitalId,
      manufacturerId,
      expiryTimestamp,
    );

    const registry = getMedicineRegistry();

    // Write to blockchain
    const tx = await registry.createBatch(
      batchId,
      medicineId,
      medicineName,
      hospitalId,
      manufacturerId,
      expiryTimestamp,
      batchDataHash,
    );
    await tx.wait();

    return NextResponse.json({
      success: true,
      batchId,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Create Batch]", err);
    const msg = err?.revert?.args?.[0] || err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withAuth(handler, "MANUFACTURER");
