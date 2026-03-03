// frontend/app/api/batch/[batchId]/route.js
import { NextResponse } from "next/server";
import { getMedicineRegistry } from "@/lib/blockchain";
import db from "@/lib/db";

const STATUS_LABELS = ["CREATED", "SHIPPED", "SORTED", "DELIVERED", "VERIFIED", "FLAGGED"];
const FLAG_LABELS = [
  "NONE",
  "NEAR_EXPIRY",
  "OUTSIDE_REGISTERED_LOCATION",
  "DUPLICATE_LOCATION_UPDATE",
  "INVALID_STATUS_ORDER",
  "HOSPITAL_FLAGGED",
];

export async function GET(request, { params }) {
  try {
    const { batchId } = params;
    const registry = getMedicineRegistry();

    const [
      medicineId, medicineName, hospitalId, manufacturerId,
      expiryDate, createdAt, currentStatus, currentFlagReason, exists
    ] = await registry.getBatch(batchId);

    if (!exists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Fetch history
    const [statuses, flagReasons, locationIds, imageHashes, timestamps, updatedBys] =
      await registry.getBatchHistory(batchId);

    const history = statuses.map((s, i) => ({
      status: STATUS_LABELS[Number(s)],
      flagReason: FLAG_LABELS[Number(flagReasons[i])],
      locationId: locationIds[i],
      imageHash: imageHashes[i],
      timestamp: new Date(Number(timestamps[i]) * 1000).toISOString(),
      updatedBy: updatedBys[i],
    }));

    // Enrich with off-chain image paths
    const [images] = await db.execute(
      "SELECT status_step, image_path, uploaded_at FROM batch_images WHERE batch_id = ? ORDER BY id",
      [batchId]
    );

    return NextResponse.json({
      batchId,
      medicineId,
      medicineName,
      hospitalId,
      manufacturerId,
      expiryDate: new Date(Number(expiryDate) * 1000).toISOString(),
      createdAt: new Date(Number(createdAt) * 1000).toISOString(),
      currentStatus: STATUS_LABELS[Number(currentStatus)],
      currentFlagReason: FLAG_LABELS[Number(currentFlagReason)],
      history,
      images,
    });
  } catch (err) {
    console.error("[Get Batch]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
