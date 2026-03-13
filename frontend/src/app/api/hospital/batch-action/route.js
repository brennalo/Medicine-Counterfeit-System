// frontend/app/api/hospital/batch-action/route.js
import { NextResponse } from 'next/server';
import { getMedicineRegistryAs, getMedicineRegistry } from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';
import db from '@/lib/db';

/**
 * POST body: { batchId, action: "verify" | "flag", flagReason?: string }
 *
 * Contract call is signed by the hospital's own wallet (getMedicineRegistryAs).
 * msg.sender in the contract resolves to hospitalId via UserRegistry.
 * hospitalId is therefore NOT passed to verifyBatch / flagBatch — contract
 * reads msg.sender and enforces onlyHospital + onlyBatchHospital.
 */
async function handler(request) {
  try {
    const { batchId, action, flagReason } = await request.json();

    if (!batchId || !action) {
      return NextResponse.json(
        { error: 'batchId and action required' },
        { status: 400 },
      );
    }

    if (!['verify', 'flag'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "verify" or "flag"' },
        { status: 400 },
      );
    }

    if (action === 'flag' && (!flagReason || !flagReason.trim())) {
      return NextResponse.json(
        { error: 'Flag reason is required' },
        { status: 400 },
      );
    }

    const hospitalId = request.user.userId;

    // Use read-only registry for existence check
    const readRegistry = getMedicineRegistry();
    const batchExists = await readRegistry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // ── Sign with hospital's own wallet ───────────────────────────────────────
    // msg.sender = hospital's registered wallet address
    // Contract enforces: onlyHospital + onlyBatchHospital
    // hospitalId parameter REMOVED from contract — resolved from msg.sender
    const registry = getMedicineRegistryAs(hospitalId);

    let tx;
    if (action === 'verify') {
      tx = await registry.verifyBatch(batchId);
    } else {
      tx = await registry.flagBatch(batchId);
    }

    await tx.wait();

    // ── Save manual flag reason to MySQL ──────────────────────────────────────
    // On-chain stores enum HOSPITAL_FLAGGED; full text reason lives off-chain.
    if (action === 'flag') {
      await db.execute(
        `INSERT INTO hospital_flag_reasons (batch_id, hospital_id, reason, flagged_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE reason = VALUES(reason), flagged_at = NOW()`,
        [batchId, hospitalId, flagReason.trim()],
      );
    }

    return NextResponse.json({
      success: true,
      batchId,
      action,
      flagReason: action === 'flag' ? flagReason.trim() : null,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error('[Batch Action]', err);
    const msg = err?.revert?.args?.[0] || err.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withAuth(handler, 'HOSPITAL');
