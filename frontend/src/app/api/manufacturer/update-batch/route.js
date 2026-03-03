// frontend/app/api/manufacturer/update-batch/route.js
import { NextResponse } from "next/server";
import { getMedicineRegistry, hashImageRef } from "@/lib/blockchain";
import { withAuth } from "@/lib/auth";
import db from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_RADIUS_METRES = 500;

const FLAG_REASON_LABELS = [
  "None", "Near Expiry", "Outside Registered Location",
  "Duplicate Location Update", "Invalid Status Order", "Hospital Flagged",
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const manufacturerId = request.user.userId;
    const medicineRegistry = getMedicineRegistry();

    const batchExists = await medicineRegistry.batchExistsPublic(batchId);
    if (!batchExists) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Auto-match nearest registered location for this manufacturer
    const [locationRows] = await db.execute(
      "SELECT id, name, latitude, longitude FROM locations WHERE manufacturer_id = ?",
      [manufacturerId]
    );

    let matchedLocationId = null;
    let locationValid = false;

    if (geoAvailable && locationRows.length > 0) {
      let minDist = Infinity;
      for (const loc of locationRows) {
        const dist = haversineDistance(currentLat, currentLng, parseFloat(loc.latitude), parseFloat(loc.longitude));
        if (dist < minDist) {
          minDist = dist;
          matchedLocationId = loc.id;
        }
      }
      locationValid = minDist <= ALLOWED_RADIUS_METRES;
    } else if (!geoAvailable && locationRows.length > 0) {
      matchedLocationId = locationRows[0].id;
      locationValid = false;
    }

    if (!matchedLocationId) { matchedLocationId = "none"; locationValid = false; }

    // Save image off-chain
    let imageDbId = null;
    let imageProofHash = "0x" + "0".repeat(64);

    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await mkdir(UPLOAD_DIR, { recursive: true });
      const filename = `${Date.now()}_${imageFile.name.replace(/[^a-z0-9.]/gi, "_")}`;
      await writeFile(path.join(UPLOAD_DIR, filename), buffer);
      const [result] = await db.execute(
        "INSERT INTO batch_images (batch_id, status_step, image_path) VALUES (?, ?, ?)",
        [batchId, newStatus, `/uploads/${filename}`]
      );
      imageDbId = result.insertId;
      imageProofHash = hashImageRef(imageDbId);
    }

    const tx = await medicineRegistry.updateBatchStatus(batchId, newStatus, matchedLocationId, imageProofHash, locationValid, manufacturerId);
    const receipt = await tx.wait();

    const flagEvent = receipt.logs?.map((log) => { try { return medicineRegistry.interface.parseLog(log); } catch { return null; } }).find((e) => e?.name === "BatchFlagged");
    const flagReasonIndex = flagEvent ? Number(flagEvent.args?.reason) : 0;

    return NextResponse.json({
      success: true, batchId,
      flagged: !!flagEvent,
      flagReason: flagReasonIndex,
      flagReasonLabel: FLAG_REASON_LABELS[flagReasonIndex] ?? "Unknown",
      locationValid, matchedLocationId, imageDbId, txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Update Batch]", err);
    return NextResponse.json({ error: err?.revert?.args?.[0] || err.message || "Internal error" }, { status: 500 });
  }
}

export const POST = withAuth(handler, "MANUFACTURER");
