// frontend/app/api/hospital/register-manufacturer/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserRegistry } from "@/lib/blockchain";
import { withAuth } from "@/lib/auth";

async function handler(request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ error: "userId and password required" }, { status: 400 });
    }

    const registry = getUserRegistry();

    // Check if user already exists
    const exists = await registry.userExists(userId);
    if (exists) {
      return NextResponse.json({ error: "Manufacturer ID already registered" }, { status: 409 });
    }

    // Hash password with bcrypt (cost factor 12)
    const salt = await bcrypt.genSalt(12);
    const bcryptHash = await bcrypt.hash(password, salt);

    // Store on-chain: role 2 = MANUFACTURER
    const tx = await registry.registerUser(userId, bcryptHash, 2);
    await tx.wait();

    return NextResponse.json({
      success: true,
      message: `Manufacturer ${userId} registered on-chain`,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error("[Register Manufacturer]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

export const POST = withAuth(handler, "HOSPITAL");
