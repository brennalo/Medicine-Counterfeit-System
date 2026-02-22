// frontend/lib/blockchain.js
// Server-side only – uses ethers directly with a JSON-RPC provider
// Never import this from client components

import { ethers } from "ethers";
import deployments from "./deployments.json";
import UserRegistryABI from "./abis/UserRegistry.json";
import LocationRegistryABI from "./abis/LocationRegistry.json";
import MedicineRegistryABI from "./abis/MedicineRegistry.json";

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY; // deployer/server wallet

let _provider = null;
let _signer = null;

export function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return _provider;
}

export function getSigner() {
  if (!_signer) {
    if (!PRIVATE_KEY) throw new Error("BLOCKCHAIN_PRIVATE_KEY not set");
    _signer = new ethers.Wallet(PRIVATE_KEY, getProvider());
  }
  return _signer;
}

export function getUserRegistry() {
  return new ethers.Contract(
    deployments.contracts.UserRegistry,
    UserRegistryABI,
    getSigner()
  );
}

export function getLocationRegistry() {
  return new ethers.Contract(
    deployments.contracts.LocationRegistry,
    LocationRegistryABI,
    getSigner()
  );
}

export function getMedicineRegistry() {
  return new ethers.Contract(
    deployments.contracts.MedicineRegistry,
    MedicineRegistryABI,
    getSigner()
  );
}

// ─── Batch ID generation (mirrors Solidity logic) ─────────────────────────────

export function generateBatchId(medicineId, manufacturerId, hospitalId, expiryDate) {
  const nonce = Date.now();
  const packed = ethers.solidityPacked(
    ["string", "string", "string", "uint256", "uint256"],
    [medicineId, manufacturerId, hospitalId, expiryDate, nonce]
  );
  return ethers.keccak256(packed);
}

// ─── Location data hash (mirrors off-chain → on-chain commitment) ─────────────

export function hashLocationData(name, locationType, address, lat, lng) {
  const packed = ethers.solidityPacked(
    ["string", "string", "string", "string", "string"],
    [name, locationType.toString(), address, lat.toString(), lng.toString()]
  );
  return ethers.keccak256(packed);
}

// ─── Image proof hash ─────────────────────────────────────────────────────────

export function hashImageRef(imageDbId) {
  return ethers.keccak256(ethers.toUtf8Bytes(imageDbId.toString()));
}
