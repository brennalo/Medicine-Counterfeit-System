// frontend/app/api/hospital/register-manufacturer/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ethers } from 'ethers';
import { getProvider } from '@/lib/blockchain';
import { withAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import deployments from '@/lib/deployments.json';
import UserRegistryABI from '@/lib/abis/UserRegistry.json';

const WALLETS_PATH = path.join(
  process.cwd(),
  'src',
  'lib',
  'user-wallets.json',
);
const FUND_AMOUNT = ethers.parseEther('10');

async function handler(request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json(
        { error: 'userId and password required' },
        { status: 400 },
      );
    }

    // ── Single deployer signer for this entire request ────────────────────────
    // We create ONE signer here and use it for both the fund tx and registerUser.
    // This way nonce is tracked on a single wallet instance, preventing the
    // "nonce too low" error that occurs when two separate signer instances
    // both fetch the same starting nonce independently.
    const provider = getProvider();
    const deployer = new ethers.Wallet(
      process.env.BLOCKCHAIN_PRIVATE_KEY,
      provider,
    );

    // Check if user already exists on-chain
    const registry = new ethers.Contract(
      deployments.contracts.UserRegistry,
      UserRegistryABI,
      deployer,
    );

    const exists = await registry.userExists(userId);
    if (exists) {
      return NextResponse.json(
        { error: 'Manufacturer ID already registered' },
        { status: 409 },
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const bcryptHash = await bcrypt.hash(password, salt);

    // Generate a fresh wallet for this manufacturer
    const wallet = ethers.Wallet.createRandom();

    // ── Fetch current nonce once, increment manually ──────────────────────────
    // Both transactions below go through the same deployer wallet.
    // By fetching the nonce once and passing it explicitly, we guarantee
    // tx1 uses nonce N and tx2 uses nonce N+1 with no race condition.
    const currentNonce = await provider.getTransactionCount(
      deployer.address,
      'latest',
    );

    // tx1: fund the new manufacturer wallet
    const fundTx = await deployer.sendTransaction({
      to: wallet.address,
      value: FUND_AMOUNT,
      nonce: currentNonce,
    });
    await fundTx.wait();
    console.log(`💰 Funded manufacturer wallet ${wallet.address} with 10 ETH`);

    // tx2: register the user on-chain — explicitly use nonce N+1
    const tx = await registry.registerUser(
      userId,
      bcryptHash,
      2,
      wallet.address,
      {
        nonce: currentNonce + 1,
      },
    );
    await tx.wait();

    // Persist private key to user-wallets.json
    let wallets = {};
    if (fs.existsSync(WALLETS_PATH)) {
      wallets = JSON.parse(fs.readFileSync(WALLETS_PATH, 'utf8'));
    }
    wallets[userId] = wallet.privateKey;
    fs.writeFileSync(WALLETS_PATH, JSON.stringify(wallets, null, 2));

    return NextResponse.json({
      success: true,
      message: `Manufacturer ${userId} registered on-chain`,
      walletAddress: wallet.address,
      txHash: tx.hash,
    });
  } catch (err) {
    console.error('[Register Manufacturer]', err);
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 },
    );
  }
}

export const POST = withAuth(handler, 'HOSPITAL');
