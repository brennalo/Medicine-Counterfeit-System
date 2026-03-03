import { ethers } from "ethers";
import { UserAuthABI, MedicineTrackingABI } from "@/contracts/abi";

// Contract addresses (update these after deployment)
export const CONTRACT_ADDRESSES = {
  userAuth: process.env.NEXT_PUBLIC_USER_AUTH_ADDRESS || "",
  medicineTracking: process.env.NEXT_PUBLIC_MEDICINE_TRACKING_ADDRESS || "",
};

// Get provider
export const getProvider = () => {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  // Fallback to localhost network
  return new ethers.JsonRpcProvider("http://127.0.0.1:8545");
};

// Get signer
export const getSigner = async () => {
  const provider = getProvider();
  return await provider.getSigner();
};

// Get UserAuth contract
export const getUserAuthContract = async (withSigner = true) => {
  if (withSigner) {
    const signer = await getSigner();
    return new ethers.Contract(
      CONTRACT_ADDRESSES.userAuth,
      UserAuthABI,
      signer,
    );
  } else {
    const provider = getProvider();
    return new ethers.Contract(
      CONTRACT_ADDRESSES.userAuth,
      UserAuthABI,
      provider,
    );
  }
};

// Get MedicineTracking contract
export const getMedicineTrackingContract = async (withSigner = true) => {
  if (withSigner) {
    const signer = await getSigner();
    return new ethers.Contract(
      CONTRACT_ADDRESSES.medicineTracking,
      MedicineTrackingABI,
      signer,
    );
  } else {
    const provider = getProvider();
    return new ethers.Contract(
      CONTRACT_ADDRESSES.medicineTracking,
      MedicineTrackingABI,
      provider,
    );
  }
};

// User role enum
export enum UserRole {
  None = 0,
  Hospital = 1,
  Manufacturer = 2,
}

// Batch status enum
export enum BatchStatus {
  None = 0,
  OrderCreated = 1,
  Shipped = 2,
  Distributed = 3,
  Sorted = 4,
  Delivered = 5,
  Verified = 6,
  Flagged = 7,
}

// Location type enum
export enum LocationType {
  None = 0,
  Factory = 1,
  DistributionCentre = 2,
  SortingCentre = 3,
}

declare global {
  interface Window {
    ethereum?: any;
  }
}
