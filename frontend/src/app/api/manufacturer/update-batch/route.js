// frontend/app/api/manufacturer/update-batch/route.js
import { NextResponse } from "next/server";
import {
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

// Haversine formula – returns distance in metres
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ALLOWED_RADIUS_METRES = 500; // within 500m of registered location centre

/**
 * POST multipart/form-data:
 *   batchId, newStatus (1=SHIPPED|2=SORTED|3=DELIVERED),
 *   locationId, currentLat, currentLng,
 *   imageProof (file)
 */
async function handler(request) {
  try {
    const formData = await request.formData();
    const batchId = formData.get("batchId");
    const newStatus = parseInt(formData.get("newStatus"));
    const locationId = formData.get("locationId");
    const currentLat = parseFloat(formData.get("currentLat"));
    const currentLng = parseFloat(formData.get("currentLng"));
    const imageFile = formData.get("imageProof");

    if (
      !batchId ||
      isNaN(newStatus) ||
      !locationId ||
      isNaN(currentLat) ||
      isNaN(currentLng)
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const manufacturerId = request.user.userId;
    const medicineRegistry = getMedicineRegistry();
    const locationRegistry = getLocationRegistry();

    // ── Validate batch exists ─────────────────────────────────────────────────
    const batchExists = await medicineRegistry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // ── Validate location exists and belongs to this manufacturer ─────────────
    const [, , , locManufacturerId, locExists] =
      await locationRegistry.getLocation(locationId);
    if (!locExists) {
      return NextResponse.json(
        { error: "Location not registered" },
        { status: 404 },
      );
    }
    if (locManufacturerId !== manufacturerId) {
      return NextResponse.json(
        { error: "Location not owned by you" },
        { status: 403 },
      );
    }

    // ── Off-chain geolocation check ───────────────────────────────────────────
    const [locRow] = await db.execute(
      "SELECT latitude, longitude FROM locations WHERE id = ?",
      [locationId],
    );
    let locationValid = false;
    if (locRow.length > 0) {
      const dist = haversineDistance(
        currentLat,
        currentLng,
        parseFloat(locRow[0].latitude),
        parseFloat(locRow[0].longitude),
      );
      locationValid = dist <= ALLOWED_RADIUS_METRES;
    }

    // ── Save image to disk (off-chain), store DB reference ────────────────────
    let imageDbId = null;
    let imageProofHash = "0x" + "0".repeat(64); // bytes32 zero

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
      imageProofHash = hashImageRef(imageDbId);
    }

    // ── Submit to blockchain (with all checks delegated to contract) ──────────
    const tx = await medicineRegistry.updateBatchStatus(
      batchId,
      newStatus,
      locationId,
      imageProofHash,
      locationValid,
      manufacturerId,
    );
    const receipt = await tx.wait();

    // Parse events to check if flagged
    const flagEvent = receipt.logs
      ?.map((log) => {
        try {
          return medicineRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "BatchFlagged");

    return NextResponse.json({
      success: true,
      batchId,
      flagged: !!flagEvent,
      flagReason: flagEvent?.args?.reason?.toString() ?? null,
      locationValid,
      imageDbId,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Update Batch]", err);
    const msg = err?.revert?.args?.[0] || err.message || "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withAuth(handler, "MANUFACTURER");

// Required for file upload in Next.js App Router
export const config = {
  api: { bodyParser: false },
};
