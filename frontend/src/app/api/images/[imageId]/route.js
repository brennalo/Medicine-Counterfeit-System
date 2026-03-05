import db from "@/lib/db";
import { NextResponse } from "next/server";

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

  return new Response(rows[0].image_blob, {
    headers: { "Content-Type": "image/jpeg" },
  });
}
