// frontend/app/api/auth/login/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserRegistry } from "@/lib/blockchain";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ??
    (() => {
      throw new Error("JWT_SECRET is not set");
    })(),
);

export async function POST(request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { error: "userId and password required" },
        { status: 400 },
      );
    }

    // ── Fetch credentials from on-chain ──────────────────────────────────────
    const registry = getUserRegistry();
    const [bcryptHash, role, exists] = await registry.getCredentials(userId);

    if (!exists) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // ── BCrypt.checkpw equivalent ─────────────────────────────────────────────
    const valid = await bcrypt.compare(password, bcryptHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // ── Issue JWT ─────────────────────────────────────────────────────────────
    const roleStr = role === 1n ? "HOSPITAL" : "MANUFACTURER";

    const token = await new SignJWT({ userId, role: roleStr })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      success: true,
      userId,
      role: roleStr,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Login Error]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
