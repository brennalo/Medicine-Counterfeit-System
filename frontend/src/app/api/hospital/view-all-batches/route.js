// frontend/app/api/hospital/view-all-batches/route.js
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

const STATUS_NAMES = [
  'CREATED',
  'SHIPPED',
  'SORTED',
  'DISTRIBUTED',
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
      const statusName = STATUS_NAMES[statusCode] ?? 'UNKNOWN';

      // Get manual flag reason from MySQL (only relevant if FLAGGED by hospital)
      const [reasonRows] = await db.execute(
        'SELECT reason, flagged_at FROM hospital_flag_reasons WHERE batch_id = ? AND hospital_id = ?',
        [batchId, hospitalId],
      );

      batches.push({
        batchId,
        medicineId,
        medicineName: medicineName || 'Unknown',
        manufacturerId,
        expiryDate: new Date(Number(expiryDate) * 1000).toISOString(),
        createdAt: new Date(Number(createdAt) * 1000).toISOString(),
        status: statusName,
        flagReason:
          statusCode === 6
            ? (FLAG_REASON_LABELS[Number(currentFlagReason)] ?? 'Unknown')
            : null,
        flagReasonCode: statusCode === 6 ? Number(currentFlagReason) : null,
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
