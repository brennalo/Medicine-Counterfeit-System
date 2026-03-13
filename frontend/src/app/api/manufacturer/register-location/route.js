// frontend/app/api/manufacturer/register-location/route.js
import { NextResponse } from "next/server";
import { getLocationRegistry, hashLocationData } from "@/lib/blockchain";
import { withAuth } from "@/lib/auth";
import db from "@/lib/db";
import { randomBytes } from "crypto";

/**
 * POST body: {
 *   name, locationType ("FACTORY"|"DISTRIBUTION_CENTER"|"SORTING_CENTER"),
 *   address, latitude, longitude
 * }
 */
const LOCATION_TYPES = {
  FACTORY: 0,
  DISTRIBUTION_CENTER: 1,
  SORTING_CENTER: 2,
};

async function handler(request) {
  try {
    const { name, locationType, address, latitude, longitude } =
      await request.json();

    if (
      !name ||
      !locationType ||
      !address ||
      latitude == null ||
      longitude == null
    ) {
      return NextResponse.json(
        { error: "All location fields required" },
        { status: 400 },
      );
    }

    if (!(locationType in LOCATION_TYPES)) {
      return NextResponse.json(
        { error: "Invalid location type" },
        { status: 400 },
      );
    }

    const manufacturerId = request.user.userId;

    // Generate unique locationId
    const locationId = `loc_${randomBytes(8).toString("hex")}`;

    // Compute commitment hash of off-chain data
    const locationDataHash = hashLocationData(
      name,
      locationType,
      address,
      latitude,
      longitude,
    );

    // ── Save full data to MySQL ───────────────────────────────────────────────
    await db.execute(
      `INSERT INTO locations (id, name, type, address, latitude, longitude, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        locationId,
        name,
        locationType,
        address,
        latitude,
        longitude,
        manufacturerId,
      ],
    );

    // ── Store hash + metadata on-chain ───────────────────────────────────────
    const registry = getLocationRegistry();
    const tx = await registry.registerLocation(
      locationId,
      name,
      LOCATION_TYPES[locationType],
      locationDataHash,
      manufacturerId,
    );
    await tx.wait();

    return NextResponse.json({
      success: true,
      locationId,
      locationDataHash,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Register Location]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler, "MANUFACTURER");
