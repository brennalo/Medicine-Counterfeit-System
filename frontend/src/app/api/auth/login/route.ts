import { NextRequest, NextResponse } from "next/server";
import { getUserAuthContract, UserRole } from "@/lib/web3";

export async function POST(request: NextRequest) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { error: "User ID and password are required" },
        { status: 400 },
      );
    }

    const contract = await getUserAuthContract(true);

    // Call verifyCredentials (read-only, no transaction)
    const [isValid, role] = await contract.verifyCredentials(userId, password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Get user info
    const [name, businessId, userRole, isActive] =
      await contract.getUserInfo(userId);

    if (!isActive) {
      return NextResponse.json(
        { error: "User account is inactive" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        userId,
        name,
        businessId,
        role: Number(userRole),
        roleName: userRole === UserRole.Hospital ? "Hospital" : "Manufacturer",
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "Login failed" },
      { status: 500 },
    );
  }
}
