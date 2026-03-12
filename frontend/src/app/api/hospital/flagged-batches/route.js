// frontend/app/api/hospital/flagged-batches/route.js
import { NextResponse } from 'next/server';
import { getMedicineRegistry } from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';
import db from '@/lib/db';

const FLAG_REASON_LABELS = [
  'None',
  'Near Expiry',
  'Outside Registered Location',
  'Duplicate Location Update',
  'Invalid Status Order',
  'Hospital Flagged',
];

// Status codes from contract: 3=DELIVERED, 4=VERIFIED, 5=FLAGGED
const TERMINAL_STATUSES = new Set([3, 4, 5]);
const STATUS_NAMES = [
  'CREATED',
  'SHIPPED',
  'SORTED',
  'DELIVERED',
  'VERIFIED',
  'FLAGGED',
];

async function handler(request) {
  try {
    const hospitalId = request.user.userId;
    const registry = getMedicineRegistry();

    const batchIds = await registry.getHospitalBatches(hospitalId);
    const batches = [];

    for (const batchId of batchIds) {
      const [
        medicineId,
        medicineName,
        ,
        manufacturerId,
        expiryDate,
        createdAt,
        currentStatus,
        currentFlagReason,
        exists,
      ] = await registry.getBatch(batchId);

      const statusCode = Number(currentStatus);

      // Only include DELIVERED, VERIFIED, FLAGGED
      if (!TERMINAL_STATUSES.has(statusCode)) continue;

      const statusName = STATUS_NAMES[statusCode] ?? 'UNKNOWN';

      // Get manual flag reason from MySQL (only relevant if FLAGGED by hospital)
      const [reasonRows] = await db.execute(
        'SELECT reason, flagged_at FROM hospital_flag_reasons WHERE batch_id = ? AND hospital_id = ?',
        [batchId, hospitalId],
      );

      // Get medicine name from off-chain if not on-chain
      const [offChain] = await db.execute(
        'SELECT medicine_name FROM batch_off_chain WHERE batch_id = ?',
        [batchId],
      );

      batches.push({
        batchId,
        medicineId,
        medicineName: medicineName || offChain[0]?.medicine_name || 'Unknown',
        manufacturerId,
        expiryDate: new Date(Number(expiryDate) * 1000).toISOString(),
        createdAt: new Date(Number(createdAt) * 1000).toISOString(),
        status: statusName,
        flagReason:
          statusCode === 5
            ? (FLAG_REASON_LABELS[Number(currentFlagReason)] ?? 'Unknown')
            : null,
        flagReasonCode: statusCode === 5 ? Number(currentFlagReason) : null,
        manualReason: reasonRows[0]?.reason ?? null,
        flaggedAt: reasonRows[0]?.flagged_at ?? null,
      });
    }

    // Sort newest first
    batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ batches });
  } catch (err) {
    console.error('[All Batches]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(handler, 'HOSPITAL');
