// scripts/deploy.js
import hre from "hardhat";
import "@nomicfoundation/hardhat-toolbox";
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  // Deploy UserAuth
  const UserAuth = await ethers.getContractFactory("UserAuth");
  const userAuth = await UserAuth.deploy();
  await userAuth.waitForDeployment();
  const userAuthAddress = await userAuth.getAddress();
  console.log("✅ UserAuth deployed to:", userAuthAddress);

  // Deploy LocationRegistry
  const LocationRegistry = await ethers.getContractFactory("LocationRegistry");
  const locationRegistry = await LocationRegistry.deploy();
  await locationRegistry.waitForDeployment();
  const locationRegistryAddress = await locationRegistry.getAddress();
  console.log("✅ LocationRegistry deployed to:", locationRegistryAddress);

  // Deploy MedicineRegistry
  const MedicineRegistry = await ethers.getContractFactory("MedicineRegistry");
  const medicineRegistry = await MedicineRegistry.deploy();
  await medicineRegistry.waitForDeployment();
  const medicineRegistryAddress = await medicineRegistry.getAddress();
  console.log("✅ MedicineRegistry deployed to:", medicineRegistryAddress);

  // Save deployment addresses to a JSON file consumed by Next.js
  const deploymentData = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    contracts: {
      UserAuth: userAuthAddress,
      LocationRegistry: locationRegistryAddress,
      MedicineRegistry: medicineRegistryAddress,
    },
  };

  // Use absolute path to avoid creating frontend inside backend
  const frontendLibDir = path.resolve(__dirname, "../../frontend/src/lib");
  const outputPath = path.join(frontendLibDir, "deployments.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(
    "\n📄 Deployment addresses saved to frontend/src/lib/deployments.json",
  );

  // Also copy ABIs to frontend/src/lib/abis
  const contracts = ["UserAuth", "LocationRegistry", "MedicineRegistry"];
  const abiOutputDir = path.join(frontendLibDir, "abis");
  fs.mkdirSync(abiOutputDir, { recursive: true });

  for (const contractName of contracts) {
    const artifact = require(`../artifacts/contracts/${contractName}.sol/${contractName}.json`);
    fs.writeFileSync(
      path.join(abiOutputDir, `${contractName}.json`),
      JSON.stringify(artifact.abi, null, 2),
    );
  }
  console.log("📄 ABIs copied to frontend/src/lib/abis/");

  // Register a default hospital for testing with YOUR custom message
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

  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
