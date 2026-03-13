// frontend/app/api/manufacturer/update-batch/route.js
import { NextResponse } from "next/server";
import {
  getMedicineRegistryAs,
  getMedicineRegistry,
  getLocationRegistry,
  hashImageRef,
} from "@/lib/blockchain";
import { withAuth } from "@/lib/auth";
import db from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_RADIUS_METRES = 500;

const FLAG_REASON_LABELS = [
  "None",
  "Near Expiry",
  "Outside Registered Location",
  "Duplicate Location Update",
  "Invalid Status Order",
  "Hospital Flagged",
];

// Maps: newStatus → required location type in MySQL
// Status codes: 0=CREATED,1=SHIPPED,2=SORTED,3=DISTRIBUTED,4=DELIVERED,5=VERIFIED,6=FLAGGED
// Transition:  CREATED(0)→SHIPPED(1)      must be at FACTORY
//              SHIPPED(1)→SORTED(2)       must be at SORTING_CENTER
//              SORTED(2)→DISTRIBUTED(3)   must be at DISTRIBUTION_CENTER
//              DISTRIBUTED(3)→DELIVERED(4) must be at HOSPITAL
const REQUIRED_LOCATION_TYPE = {
  1: "FACTORY",
  2: "SORTING_CENTER",
  3: "DISTRIBUTION_CENTER",
  4: "HOSPITAL",
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
    const batchId = formData.get("batchId");
    const newStatus = parseInt(formData.get("newStatus"));
    const currentLat = parseFloat(formData.get("currentLat"));
    const currentLng = parseFloat(formData.get("currentLng"));
    const geoAvailable = formData.get("geoAvailable") === "true";
    const imageFile = formData.get("imageProof");

    if (!batchId || isNaN(newStatus)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const manufacturerId = request.user.userId;

    // Use read-only registry for lookups
    const medicineRegistry = getMedicineRegistry();
    const locationRegistry = getLocationRegistry();

    const batchExists = await medicineRegistry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const requiredType = REQUIRED_LOCATION_TYPE[newStatus];

    // For DELIVERED (newStatus=4): match against the assigned hospital's location
    // For all others: match against manufacturer's own registered locations
    let locationRows;
    if (newStatus === 4) {
      const batchData = await medicineRegistry.getBatch(batchId);
      const hospitalId = batchData[2]; // index 2 = hospitalId

      const [hospLocs] = await db.execute(
        "SELECT id, name, latitude, longitude, type FROM locations WHERE user_id = ? AND type = 'HOSPITAL'",
        [hospitalId],
      );
      locationRows = hospLocs;
    } else {
      const [mfrLocs] = await db.execute(
        "SELECT id, name, latitude, longitude, type FROM locations WHERE user_id = ? AND type = ?",
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
      locationValid = minDist <= ALLOWED_RADIUS_METRES;
    } else if (!geoAvailable && locationRows.length > 0) {
      matchedLocationId = locationRows[0].id;
      locationType = locationRows[0].type;
      locationValid = false; // no GPS = invalid
    }

    if (!matchedLocationId) {
      matchedLocationId = "none";
      locationValid = false;
    }

    // ── Save image off-chain ──────────────────────────────────────────────────
    let imageDbId = null;
    let imageProofHash = "0x" + "0".repeat(64);

    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Compress image (e.g., JPEG, quality 70)
      const compressedBuffer = await sharp(buffer)
        .jpeg({ quality: 70 })
        .toBuffer();

      // Store compressed image as BLOB in MySQL
      const [result] = await db.execute(
        "INSERT INTO batch_images (batch_id, status_step, image_blob) VALUES (?, ?, ?)",
        [batchId, newStatus, compressedBuffer],
      );

      imageDbId = result.insertId;

      // Hash actual image bytes for on-chain integrity proof
      imageProofHash = hashImageRef(compressedBuffer);
    }

    // ── Sign with manufacturer's own wallet ───────────────────────────────────
    // msg.sender = manufacturer's registered wallet address
    // Contract enforces: onlyManufacturer + onlyBatchManufacturer
    // _updatedBy parameter REMOVED from contract — resolved from msg.sender
    const registryAs = getMedicineRegistryAs(manufacturerId);

    const tx = await registryAs.updateBatchStatus(
      batchId,
      newStatus,
      matchedLocationId.toString(),
      imageProofHash,
      locationValid,
      // manufacturerId NOT passed — contract reads msg.sender
    );
    const receipt = await tx.wait();

    const flagEvent = receipt.logs
      ?.map((log) => {
        try {
          return registryAs.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "BatchFlagged");

    const flagReasonIndex = flagEvent ? Number(flagEvent.args?.reason) : 0;

    return NextResponse.json({
      success: true,
      batchId,
      flagged: !!flagEvent,
      flagReason: flagReasonIndex,
      flagReasonLabel: FLAG_REASON_LABELS[flagReasonIndex] ?? "Unknown",
      locationValid,
      matchedLocationId,
      locationType,
      requiredLocationType: requiredType,
      imageDbId,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Update Batch]", err);
    return NextResponse.json(
      { error: err?.revert?.args?.[0] || err.message || "Internal error" },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler, "MANUFACTURER");
