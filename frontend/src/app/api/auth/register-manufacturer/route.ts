import { NextRequest, NextResponse } from "next/server";
import { getUserAuthContract } from "@/lib/web3";

export async function POST(request: NextRequest) {
  try {
    const {
      hospitalId,
      hospitalPassword,
      manufacturerId,
      manufacturerName,
      manufacturerBusinessId,
      manufacturerPassword,
    } = await request.json();

    // Validate inputs
    if (!hospitalId || !hospitalPassword) {
      return NextResponse.json(
        { error: "Hospital credentials are required" },
        { status: 400 },
      );
    }

    if (
      !manufacturerId ||
      !manufacturerName ||
      !manufacturerBusinessId ||
      !manufacturerPassword
    ) {
      return NextResponse.json(
        { error: "All manufacturer fields are required" },
        { status: 400 },
      );
    }

    const contract = await getUserAuthContract(true);

    // Register manufacturer
    const tx = await contract.registerManufacturer(
      hospitalId,
      hospitalPassword,
      manufacturerId,
      manufacturerName,
      manufacturerBusinessId,
      manufacturerPassword,
    );

    // Wait for transaction to be mined
    await tx.wait();

    return NextResponse.json({
      success: true,
      message: "Manufacturer registered successfully",
      manufacturerId,
    });
  } catch (error: any) {
    console.error("Registration error:", error);

    // Parse error message
    let errorMessage = "Registration failed";
    if (error.message) {
      if (error.message.includes("Hospital not found")) {
        errorMessage = "Hospital not found";
      } else if (error.message.includes("Invalid hospital password")) {
        errorMessage = "Invalid hospital password";
      } else if (error.message.includes("ID already exists")) {
        errorMessage = "Manufacturer ID already exists";
      } else if (error.message.includes("Only hospitals")) {
        errorMessage = "Only hospitals can register manufacturers";
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
