// scripts/deploy.js
require('dotenv').config({ path: '.env.local' });

const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log(
    'Account balance:',
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  // Deploy UserRegistry
  const UserRegistry = await ethers.getContractFactory('UserRegistry');
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log('✅ UserRegistry deployed to:', userRegistryAddress);

  // Deploy LocationRegistry
  const LocationRegistry = await ethers.getContractFactory('LocationRegistry');
  const locationRegistry = await LocationRegistry.deploy();
  await locationRegistry.waitForDeployment();
  const locationRegistryAddress = await locationRegistry.getAddress();
  console.log('✅ LocationRegistry deployed to:', locationRegistryAddress);

  // Deploy MedicineRegistry
  const MedicineRegistry = await ethers.getContractFactory('MedicineRegistry');
  const medicineRegistry = await MedicineRegistry.deploy();
  await medicineRegistry.waitForDeployment();
  const medicineRegistryAddress = await medicineRegistry.getAddress();
  console.log('✅ MedicineRegistry deployed to:', medicineRegistryAddress);

  // Save deployment addresses to a JSON file consumed by Next.js
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

  // Use absolute path to avoid creating frontend inside backend
  const frontendLibDir = path.resolve(__dirname, '../../frontend/src/lib');
  const outputPath = path.join(frontendLibDir, 'deployments.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
  console.log(
    '\n📄 Deployment addresses saved to frontend/src/lib/deployments.json',
  );

  // Also copy ABIs to frontend/src/lib/abis
  const contracts = ['UserRegistry', 'LocationRegistry', 'MedicineRegistry'];
  const abiOutputDir = path.join(frontendLibDir, 'abis');
  fs.mkdirSync(abiOutputDir, { recursive: true });

  for (const contractName of contracts) {
    const artifact = require(`../artifacts/contracts/${contractName}.sol/${contractName}.json`);
    fs.writeFileSync(
      path.join(abiOutputDir, `${contractName}.json`),
      JSON.stringify(artifact.abi, null, 2),
    );
  }
  console.log('📄 ABIs copied to frontend/src/lib/abis/');

  // Seed a default hospital admin account
  const bcrypt = require('bcryptjs');
  const defaultPassword = process.env.DEFAULT_PASSWORD;
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(defaultPassword, salt);

  await userRegistry.registerUser('hospital_admin', hash, 1); // First Hospital Account
  await userRegistry.registerUser('hospital_admin2', hash, 1); // Second Hospital Account
  console.log('\n🌱 Seeded default hospital: hospital_admin / admin123');

  console.log('\n✅ Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
