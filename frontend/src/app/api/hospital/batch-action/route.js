// frontend/app/api/hospital/batch-action/route.js
import { NextResponse } from 'next/server';
import { getMedicineRegistry } from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';
import db from '@/lib/db';

/**
 * POST body: { batchId, action: "verify" | "flag", flagReason?: string }
 * flagReason is a manual text reason entered by the hospital (stored in MySQL)
 * The on-chain status is set to FLAGGED with enum HOSPITAL_FLAGGED (5)
 * The full text reason is stored off-chain in MySQL for display
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
    const registry = getMedicineRegistry();

    // Check batch exists on-chain
    const batchExists = await registry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    let tx;
    if (action === 'verify') {
      tx = await registry.verifyBatch(batchId, hospitalId);
    } else {
      // Flag on-chain (stores enum HOSPITAL_FLAGGED)
      tx = await registry.flagBatch(batchId, hospitalId);
    }

    await tx.wait();

    // If flagging, save the manual text reason to MySQL
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
