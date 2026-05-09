// frontend/lib/blockchain.js
// Server-side only – uses ethers directly with a JSON-RPC provider
// Never import this from client components

import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { join } from 'path';
import deployments from './deployments.json';
import UserRegistryABI from './abis/UserRegistry.json';
import LocationRegistryABI from './abis/LocationRegistry.json';
import MedicineRegistryABI from './abis/MedicineRegistry.json';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

// Path to user wallets file — written by deploy.js and register-manufacturer API
const WALLETS_PATH = join(process.cwd(), 'src', 'lib', 'user-wallets.json');

// Provider is safe to cache — it holds no nonce state
let _provider = null;

export function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return _provider;
}

/**
 * Deployer signer — created FRESH on every call.
 * Never cached — ethers.Wallet caches nonce internally, so a cached signer
 * gets out of sync when multiple transactions go out in the same request.
 */
export function getSigner() {
  if (!PRIVATE_KEY) throw new Error('BLOCKCHAIN_PRIVATE_KEY not set');
  return new ethers.Wallet(PRIVATE_KEY, getProvider());
}

/**
 * Returns a fresh signer for the given userId.
 *
 * Uses fs.readFileSync instead of require() so it always reads the latest
 * file from disk. require() caches the module on first load and will never
 * pick up manufacturers registered after the server started.
 */
export function getUserSigner(userId) {
  let wallets;
  try {
    wallets = JSON.parse(readFileSync(WALLETS_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read user-wallets.json: ${err.message}`);
  }

  const privateKey = wallets[userId];
  if (!privateKey) throw new Error(`No wallet registered for user: ${userId}`);
  return new ethers.Wallet(privateKey, getProvider());
}

// ── Contract getters ──────────────────────────────────────────────────────────

export function getUserRegistry() {
  return new ethers.Contract(
    deployments.contracts.UserRegistry,
    UserRegistryABI,
    getSigner(),
  );
}

export function getLocationRegistry() {
  return new ethers.Contract(
    deployments.contracts.LocationRegistry,
    LocationRegistryABI,
    getSigner(),
  );
}

// MedicineRegistry — deployer signer, for read-only (view) calls only
export function getMedicineRegistry() {
  return new ethers.Contract(
    deployments.contracts.MedicineRegistry,
    MedicineRegistryABI,
    getSigner(),
  );
}

/**
 * MedicineRegistry connected to a specific user's own wallet.
 * Use for ALL state-changing calls: createBatch, updateBatchStatus,
 * verifyBatch, flagBatch.
 *
 * msg.sender = user's registered wallet → RBAC + identity binding enforced.
 */
export function getMedicineRegistryAs(userId) {
  return new ethers.Contract(
    deployments.contracts.MedicineRegistry,
    MedicineRegistryABI,
    getUserSigner(userId),
  );
}

// ── Hashing helpers ───────────────────────────────────────────────────────────

export function generateBatchId(
  medicineId,
  manufacturerId,
  hospitalId,
  expiryDate,
) {
  const nonce = Date.now();
  const packed = ethers.solidityPacked(
    ['string', 'string', 'string', 'uint256', 'uint256'],
    [medicineId, manufacturerId, hospitalId, expiryDate, nonce],
  );
  return ethers.keccak256(packed);
}

export function hashLocationData(name, locationType, address, lat, lng) {
  const packed = ethers.solidityPacked(
    ['string', 'string', 'string', 'string', 'string'],
    [name, locationType.toString(), address, lat.toString(), lng.toString()],
  );
  return ethers.keccak256(packed);
}

// Hashes actual image bytes — not a DB row ID
export function hashImageRef(imageBuffer) {
  return ethers.keccak256(new Uint8Array(imageBuffer));
}

export function hashBatchData(
  medicineId,
  medicineName,
  hospitalId,
  manufacturerId,
  expiryTimestamp,
) {
  const packed = ethers.solidityPacked(
    ['string', 'string', 'string', 'string', 'uint256'],
    [medicineId, medicineName, hospitalId, manufacturerId, expiryTimestamp],
  );
  return ethers.keccak256(packed);
}
