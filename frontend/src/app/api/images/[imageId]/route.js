import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getMedicineRegistry, hashImageRef } from "@/lib/blockchain";

export async function GET(request, { params }) {
  const { imageId } = await params; // ← await params

  if (!imageId) {
    return NextResponse.json({ error: "Missing image ID" }, { status: 400 });
  }

  const [rows] = await db.execute(
    "SELECT image_blob FROM batch_images WHERE id = ?",
    [imageId],
  );

  if (!rows.length || !rows[0].image_blob) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // ── Tamper check: verify image blob matches on-chain hash ─────────────────
  const imageBuffer = rows[0].image_blob;
  const computedHash = hashImageRef(Buffer.from(imageBuffer));

  // Get the batch_id for this image to look up on-chain history
  const [imageRow] = await db.execute(
    "SELECT batch_id, status_step FROM batch_images WHERE id = ?",
    [imageId],
  );

  if (imageRow.length > 0) {
    const { batch_id, status_step } = imageRow[0];
    const registry = getMedicineRegistry();
    const [, , , imageHashes] = await registry.getBatchHistory(batch_id);

    // Find the history entry matching this status step
    const onChainHash = imageHashes[status_step];

    if (onChainHash && computedHash !== onChainHash) {
      console.error(
        `[TAMPER DETECTED] Image ${imageId} does not match on-chain hash`,
      );
      return NextResponse.json(
        { error: "Image integrity check failed" },
        { status: 500 },
      );
    }
  }

  return new Response(imageBuffer, {
    headers: { "Content-Type": "image/jpeg" },
  });
}
