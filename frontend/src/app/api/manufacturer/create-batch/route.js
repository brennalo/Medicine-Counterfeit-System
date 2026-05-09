// frontend/app/api/manufacturer/create-batch/route.js
import { NextResponse } from 'next/server';
import {
  getMedicineRegistryAs,
  generateBatchId,
  getUserRegistry,
  hashBatchData,
} from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';

/**
 * POST body: { medicineId, medicineName, hospitalId, expiryDate (ISO string) }
 *
 * Contract call is signed by the manufacturer's own wallet (getMedicineRegistryAs).
 * msg.sender in the contract resolves to manufacturerId via UserRegistry.
 * manufacturerId is therefore NOT passed to createBatch — contract reads msg.sender.
 */
async function handler(request) {
  try {
    const { medicineId, medicineName, hospitalId, expiryDate } =
      await request.json();

    if (!medicineId || !medicineName || !hospitalId || !expiryDate) {
      return NextResponse.json(
        { error: 'All fields required' },
        { status: 400 },
      );
    }

    const manufacturerId = request.user.userId;
    const expiryTimestamp = Math.floor(new Date(expiryDate).getTime() / 1000);

    if (expiryTimestamp <= Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: 'Expiry date must be in the future' },
        { status: 400 },
      );
    }

    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    if (new Date(expiryDate) <= oneMonthFromNow) {
      return NextResponse.json(
        { error: 'Expiry date must be more than one month from today' },
        { status: 400 },
      );
    }

    // ── Validate hospital exists on-chain ─────────────────────────────────────
    const userReg = getUserRegistry();
    const hospitalExists = await userReg.userExists(hospitalId);
    if (!hospitalExists) {
      return NextResponse.json(
        { error: 'Hospital ID does not exist' },
        { status: 400 },
      );
    }
    const hospitalRole = await userReg.getUserRole(hospitalId);
    if (Number(hospitalRole) !== 1) {
      return NextResponse.json(
        { error: 'Provided ID is not a hospital' },
        { status: 400 },
      );
    }

    // ── Generate batch ID ─────────────────────────────────────────────────────
    const batchId = generateBatchId(
      medicineId,
      manufacturerId,
      hospitalId,
      expiryTimestamp,
    );
    const batchDataHash = hashBatchData(
      medicineId,
      medicineName,
      hospitalId,
      manufacturerId,
      expiryTimestamp,
    );

    // ── Sign with manufacturer's own wallet ───────────────────────────────────
    // msg.sender in contract = manufacturer's registered wallet address
    // Contract resolves manufacturerId from msg.sender via UserRegistry
    const registry = getMedicineRegistryAs(manufacturerId);

    const tx = await registry.createBatch(
      batchId,
      medicineId,
      medicineName,
      hospitalId,
      expiryTimestamp,
      batchDataHash,
      // manufacturerId is NOT passed — contract reads msg.sender
    );
    await tx.wait();

    return NextResponse.json({ success: true, batchId, txHash: tx.hash });
  } catch (err) {
    console.error('[Create Batch]', err);
    const msg = err?.revert?.args?.[0] || err.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withAuth(handler, 'MANUFACTURER');
