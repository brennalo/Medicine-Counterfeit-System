// frontend/app/api/manufacturer/my-batches/route.js
import { NextResponse } from 'next/server';
import { getMedicineRegistry } from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';

const STATUS_NAMES = [
  'CREATED',
  'SHIPPED',
  'SORTED',
  'DISTRIBUTED',
  'DELIVERED',
  'VERIFIED',
  'FLAGGED',
];
const FLAG_REASON_LABELS = [
  'None',
  'Near Expiry',
  'Outside Registered Location',
  'Duplicate Location Update',
  'Invalid Status Order',
  'Hospital Flagged',
];

async function handler(request) {
  try {
    const manufacturerId = request.user.userId;
    const registry = getMedicineRegistry();

    const batchIds = await registry.getManufacturerBatches(manufacturerId);
    const batches = [];

    for (const batchId of batchIds) {
      const [
        medicineId,
        medicineName,
        hospitalId,
        ,
        expiryDate,
        createdAt,
        currentStatus,
        currentFlagReason,
        exists,
      ] = await registry.getBatch(batchId);

      if (!exists) continue;

      const statusCode = Number(currentStatus);

      batches.push({
        batchId,
        medicineId,
        medicineName: medicineName || 'Unknown',
        hospitalId,
        expiryDate: new Date(Number(expiryDate) * 1000).toISOString(),
        createdAt: new Date(Number(createdAt) * 1000).toISOString(),
        status: STATUS_NAMES[statusCode] ?? 'UNKNOWN',
        flagReason:
          statusCode === 5
            ? (FLAG_REASON_LABELS[Number(currentFlagReason)] ?? 'Unknown')
            : null,
      });
    }

    // Newest first
    batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ batches });
  } catch (err) {
    console.error('[My Batches]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const GET = withAuth(handler, 'MANUFACTURER');
