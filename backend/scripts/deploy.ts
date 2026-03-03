import hre from "hardhat";
import "@nomicfoundation/hardhat-toolbox";

async function main() {
  console.log("Deploying Medicine Counterfeit System contracts...");

  // Deploy UserAuth
  const UserAuth = await hre.ethers.getContractFactory("UserAuth");
  const userAuth = await UserAuth.deploy();
  await userAuth.waitForDeployment();
  const userAuthAddress = await userAuth.getAddress();
  console.log(`UserAuth deployed to: ${userAuthAddress}`);

  // Deploy MedicineTracking
  const MedicineTracking = await hre.ethers.getContractFactory(
    "MedicineTracking",
  );
  const medicineTracking = await MedicineTracking.deploy();
  await medicineTracking.waitForDeployment();
  const medicineTrackingAddress = await medicineTracking.getAddress();
  console.log(`MedicineTracking deployed to: ${medicineTrackingAddress}`);

  // Register a default hospital for testing
  console.log("\nRegistering default hospital...");
  const tx = await userAuth.registerHospital(
    "HOSPITAL001",
    "General Hospital",
    "BIZ-HOSP-001",
    "hospital123",
  );
  await tx.wait();
  console.log("Default hospital registered:");
  console.log("  User ID: HOSPITAL001");
  console.log("  Password: hospital123");
  console.log("  Name: General Hospital");
  console.log("  Business ID: BIZ-HOSP-001");

  // Save contract addresses to a file
  const { writeFileSync } = await import("fs");
  const addresses = {
    userAuth: userAuthAddress,
    medicineTracking: medicineTrackingAddress,
    network: "localhost",
    deployedAt: new Date().toISOString(),
  };

  writeFileSync(
    "./deployed-contracts.json",
    JSON.stringify(addresses, null, 2),
  );
  console.log("\nContract addresses saved to deployed-contracts.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
