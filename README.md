# Medicine-Counterfeit-System

A blockchain-based system for preventing medicine counterfeiting and tracking pharmaceutical supply chains. This system enables hospitals and manufacturers to securely track medicine batches from production to delivery using smart contracts on the Ethereum blockchain.

## 🎯 Project Overview

This is a blockchain development assignment for university that implements a complete medicine counterfeit prevention system with:

- Secure user authentication (Hospital & Manufacturer)
- Medicine batch creation and tracking
- Location verification system
- Real-time status updates
- Counterfeit detection and flagging

## 🚀 Quick Start

See [SETUP.md](SETUP.md) for detailed installation and setup instructions.

### Basic Setup

1. **Backend (Blockchain)**

   ```bash
   cd backend
   npm install
   npx hardhat node  # Terminal 1 - Keep running
   npx hardhat run scripts/deploy.ts --network localhost  # Terminal 2
   ```

2. **Frontend (Next.js)**

   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with deployed contract addresses
   npm run dev
   ```

3. **Access the Application**
   - Open http://localhost:3000
   - Default Hospital Login: `HOSPITAL001` / `hospital123`

## ✨ Features

### Implemented

✅ Hospital and Manufacturer Login
✅ Hospital can register manufacturers
✅ Smart contract-based authentication
✅ Secure password hashing on blockchain
✅ Role-based access control
✅ Responsive UI with Tailwind CSS

### In Development

🔲 Location registration (Factory, Distribution, Sorting centres)
🔲 Medicine batch creation
🔲 Batch status updates with validation
🔲 View medicine batch lists
🔲 Flag suspicious batches
🔲 Batch history tracking
🔲 MySQL integration for off-chain data

## 🛠️ Technology Stack

- **Blockchain:** Hardhat, Solidity ^0.8.28, Ethereum
- **Frontend:** Next.js 15, React 19, TypeScript
- **Web3:** ethers.js v6
- **Styling:** Tailwind CSS
- **Database:** MySQL (planned for off-chain storage)
- **Development:** Visual Studio Code

## 📁 Project Structure

```
Medicine-Counterfeit-System/
├── backend/                    # Blockchain & Smart Contracts
│   ├── contracts/
│   │   ├── UserAuth.sol       # Authentication contract
│   │   └── MedicineTracking.sol  # Tracking contract
│   ├── scripts/
│   │   └── deploy.ts
│   └── hardhat.config.ts
│
└── frontend/                   # Next.js Application
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx       # Home page
    │   │   ├── api/           # API routes
    │   │   ├── hospital/      # Hospital pages
    │   │   └── manufacturer/  # Manufacturer pages
    │   ├── contracts/         # Contract ABIs
    │   └── lib/               # Utilities
    └── .env.example
```

## 🔐 User Roles

### Hospital

- Log in with credentials
- Register new manufacturers
- Verify medicine batches
- Flag suspicious batches
- View batch history

### Manufacturer

- Log in with assigned credentials
- Register production/distribution locations
- Create medicine batches
- Update batch status
- Track shipments

## 📖 Documentation

- [SETUP.md](SETUP.md) - Detailed setup guide
- [Smart Contract Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)

## 🧪 Development

```bash
# Backend
cd backend
npx hardhat compile          # Compile contracts
npx hardhat test             # Run tests
npx hardhat node             # Start local blockchain

# Frontend
cd frontend
npm run dev                  # Start dev server
npm run build                # Build for production
```

## 📝 Scope & Assumptions

### Scope

- Two user types: Hospital and Manufacturer
- Medicine batch tracking through supply chain
- Location verification system
- Duplicate scan detection
- Expiry date validation
- Off-chain storage for large data (images, coordinates)

### Assumptions

- Manufacturers handle both production and logistics
- Hospitals input correct manufacturer details
- Manufacturers don't actively detect counterfeits
- Flagged medicines are automatically recalled
- Delivery to hospital marks end of tracking process

## 👥 Team

Blockchain Development Assignment - University Project

## 📄 License

This project is for educational purposes.
