// scripts/deploy.js
require("dotenv").config({ path: ".env.local" });

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Amount of ETH to fund each user wallet with (from deployer)
// Hardhat local node gives deployer 10000 ETH so this is fine for development
const FUND_AMOUNT = ethers.parseEther("10");

async function fundWallet(deployer, address, label) {
  const tx = await deployer.sendTransaction({
    to: address,
    value: FUND_AMOUNT,
  });
  await tx.wait();
  console.log(`💰 Funded ${label} (${address}) with 10 ETH`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  // ── Deploy UserRegistry ───────────────────────────────────────────────────
  const UserRegistry = await ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log("✅ UserRegistry deployed to:", userRegistryAddress);

  // ── Deploy LocationRegistry ───────────────────────────────────────────────
  const LocationRegistry = await ethers.getContractFactory("LocationRegistry");
  const locationRegistry = await LocationRegistry.deploy();
  await locationRegistry.waitForDeployment();
  const locationRegistryAddress = await locationRegistry.getAddress();
  console.log("✅ LocationRegistry deployed to:", locationRegistryAddress);

  // ── Deploy MedicineRegistry — pass UserRegistry address for RBAC ──────────
  const MedicineRegistry = await ethers.getContractFactory("MedicineRegistry");
  const medicineRegistry = await MedicineRegistry.deploy(userRegistryAddress);
  await medicineRegistry.waitForDeployment();
  const medicineRegistryAddress = await medicineRegistry.getAddress();
  console.log("✅ MedicineRegistry deployed to:", medicineRegistryAddress);

  // ── Save deployment addresses ─────────────────────────────────────────────
  const deploymentData = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    contracts: {
      UserRegistry: userRegistryAddress,
      LocationRegistry: locationRegistryAddress,
      MedicineRegistry: medicineRegistryAddress,
    },
  };

  const frontendLibDir = path.resolve(__dirname, "../../frontend/src/lib");
  const outputPath = path.join(frontendLibDir, "deployments.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(
    "\n📄 Deployment addresses saved to frontend/src/lib/deployments.json",
  );

  // ── Copy ABIs ─────────────────────────────────────────────────────────────
  const contracts = ["UserRegistry", "LocationRegistry", "MedicineRegistry"];
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

  // ── Generate one wallet per seeded user, fund each from deployer ──────────
  const bcrypt = require("bcryptjs");
  const defaultPassword =
    process.env.DEFAULT_PASSWORD ??
    (() => {
      throw new Error("DEFAULT_PASSWORD not set in .env.local");
    })();
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(defaultPassword, salt);

  const hospitalWallet1 = ethers.Wallet.createRandom();
  const hospitalWallet2 = ethers.Wallet.createRandom();

  // Fund wallets BEFORE registering — gas needed for any future transactions
  await fundWallet(deployer, hospitalWallet1.address, "hospital_admin");
  await fundWallet(deployer, hospitalWallet2.address, "hospital_admin2");

  // Register on-chain: userId, bcryptHash, role (1=HOSPITAL), walletAddress
  await userRegistry.registerUser(
    "hospital_admin",
    hash,
    1,
    hospitalWallet1.address,
  );
  await userRegistry.registerUser(
    "hospital_admin2",
    hash,
    1,
    hospitalWallet2.address,
  );

  console.log("\n🌱 Seeded hospital_admin  — wallet:", hospitalWallet1.address);
  console.log("🌱 Seeded hospital_admin2 — wallet:", hospitalWallet2.address);

  // ── Save private keys for backend signing ─────────────────────────────────
  // Manufacturer wallets are appended by register-manufacturer API at runtime.
  // In production, replace with a secrets manager / HSM.
  const userWallets = {
    hospital_admin: hospitalWallet1.privateKey,
    hospital_admin2: hospitalWallet2.privateKey,
  };

  const walletsPath = path.join(frontendLibDir, "user-wallets.json");
  fs.writeFileSync(walletsPath, JSON.stringify(userWallets, null, 2));
  console.log("🔑 User wallets saved to frontend/src/lib/user-wallets.json");

  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
