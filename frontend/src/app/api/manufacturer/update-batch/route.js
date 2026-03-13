// frontend/app/api/manufacturer/update-batch/route.js
import { NextResponse } from 'next/server';
import { getMedicineRegistry, hashImageRef } from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';
import db from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_RADIUS_METRES = 500;

const FLAG_REASON_LABELS = [
  'None',
  'Near Expiry',
  'Outside Registered Location',
  'Duplicate Location Update',
  'Invalid Status Order',
  'Hospital Flagged',
];

// Maps: newStatus → required location type in MySQL
// Status codes (with DISTRIBUTED): 0=CREATED,1=SHIPPED,2=SORTED,3=DISTRIBUTED,4=DELIVERED,5=VERIFIED,6=FLAGGED
// Transition:  CREATED(0)→SHIPPED(1)   must be at FACTORY
//              SHIPPED(1)→SORTED(2)    must be at SORTING_CENTER
//              SORTED(2)→DISTRIBUTED(3) must be at DISTRIBUTION_CENTER
//              DISTRIBUTED(3)→DELIVERED(4) must be at HOSPITAL
const REQUIRED_LOCATION_TYPE = {
  1: 'FACTORY', // updating to SHIPPED — currently at factory, packing & shipping out
  2: 'SORTING_CENTER', // updating to SORTED
  3: 'DISTRIBUTION_CENTER', // updating to DISTRIBUTED
  4: 'HOSPITAL', // updating to DELIVERED — must be at hospital location
};

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function handler(request) {
  try {
    const formData = await request.formData();
    const batchId = formData.get('batchId');
    const newStatus = parseInt(formData.get('newStatus'));
    const currentLat = parseFloat(formData.get('currentLat'));
    const currentLng = parseFloat(formData.get('currentLng'));
    const geoAvailable = formData.get('geoAvailable') === 'true';
    const imageFile = formData.get('imageProof');

    if (!batchId || isNaN(newStatus)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const manufacturerId = request.user.userId;
    const medicineRegistry = getMedicineRegistry();

    const batchExists = await medicineRegistry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Get the required location type for this status transition
    const requiredType = REQUIRED_LOCATION_TYPE[newStatus];

    // For DELIVERED (newStatus=4): match against hospital location, not manufacturer locations
    // For all others: match against manufacturer's own registered locations filtered by required type
    let locationRows;
    if (newStatus === 4) {
      // Get the hospitalId this batch is assigned to
      const [batchRow] = await medicineRegistry.getBatch(batchId);
      // batchRow[2] is hospitalId — but we call getBatch which returns array
      const batchData = await medicineRegistry.getBatch(batchId);
      const hospitalId = batchData[2]; // index 2 = hospitalId

      // Look up hospital's registered location
      const [hospLocs] = await db.execute(
        "SELECT id, name, latitude, longitude, type FROM locations WHERE manufacturer_id = ? AND type = 'HOSPITAL'",
        [hospitalId],
      );
      locationRows = hospLocs;
    } else {
      // Filter manufacturer's locations by required type
      const [mfrLocs] = await db.execute(
        'SELECT id, name, latitude, longitude, type FROM locations WHERE manufacturer_id = ? AND type = ?',
        [manufacturerId, requiredType],
      );
      locationRows = mfrLocs;
    }

    let matchedLocationId = null;
    let locationValid = false;
    let locationType = null;

    if (geoAvailable && locationRows.length > 0) {
      let minDist = Infinity;
      for (const loc of locationRows) {
        const dist = haversineDistance(
          currentLat,
          currentLng,
          parseFloat(loc.latitude),
          parseFloat(loc.longitude),
        );
        if (dist < minDist) {
          minDist = dist;
          matchedLocationId = loc.id;
          locationType = loc.type;
        }
      }
      // Valid only if within radius AND the matched location is the correct type
      locationValid = minDist <= ALLOWED_RADIUS_METRES;
    } else if (!geoAvailable && locationRows.length > 0) {
      matchedLocationId = locationRows[0].id;
      locationType = locationRows[0].type;
      locationValid = false; // no GPS = invalid
    }

    if (!matchedLocationId) {
      matchedLocationId = 'none';
      locationValid = false;
    }

    // Save image off-chain
    let imageDbId = null;
    let imageProofHash = '0x' + '0'.repeat(64);

    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await mkdir(UPLOAD_DIR, { recursive: true });
      const filename = `${Date.now()}_${imageFile.name.replace(/[^a-z0-9.]/gi, '_')}`;
      await writeFile(path.join(UPLOAD_DIR, filename), buffer);
      const [result] = await db.execute(
        'INSERT INTO batch_images (batch_id, status_step, image_path) VALUES (?, ?, ?)',
        [batchId, newStatus, `/uploads/${filename}`],
      );
      imageDbId = result.insertId;
      imageProofHash = hashImageRef(imageDbId);
    }

    const tx = await medicineRegistry.updateBatchStatus(
      batchId,
      newStatus,
      matchedLocationId,
      imageProofHash,
      locationValid,
      manufacturerId,
    );
    const receipt = await tx.wait();

    const flagEvent = receipt.logs
      ?.map((log) => {
        try {
          return medicineRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === 'BatchFlagged');
    const flagReasonIndex = flagEvent ? Number(flagEvent.args?.reason) : 0;

    return NextResponse.json({
      success: true,
      batchId,
      flagged: !!flagEvent,
      flagReason: flagReasonIndex,
      flagReasonLabel: FLAG_REASON_LABELS[flagReasonIndex] ?? 'Unknown',
      locationValid,
      matchedLocationId,
      locationType,
      requiredLocationType: requiredType,
      imageDbId,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error('[Update Batch]', err);
    return NextResponse.json(
      { error: err?.revert?.args?.[0] || err.message || 'Internal error' },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler, 'MANUFACTURER');
