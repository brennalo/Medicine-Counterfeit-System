export const UserAuthABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "userId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "UserLoggedIn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "userId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "enum UserAuth.UserRole",
        name: "role",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "UserRegistered",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_userId",
        type: "string",
      },
    ],
    name: "getUserInfo",
    outputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "businessId",
        type: "string",
      },
      {
        internalType: "enum UserAuth.UserRole",
        name: "role",
        type: "uint8",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "createdAt",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_userId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_password",
        type: "string",
      },
    ],
    name: "login",
    outputs: [
      {
        internalType: "bool",
        name: "success",
        type: "bool",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "string",
        name: "businessId",
        type: "string",
      },
      {
        internalType: "enum UserAuth.UserRole",
        name: "role",
        type: "uint8",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_userId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_name",
        type: "string",
      },
      {
        internalType: "string",
        name: "_businessId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_password",
        type: "string",
      },
    ],
    name: "registerHospital",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_hospitalId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_hospitalPassword",
        type: "string",
      },
      {
        internalType: "string",
        name: "_manufacturerId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_manufacturerName",
        type: "string",
      },
      {
        internalType: "string",
        name: "_manufacturerBusinessId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_manufacturerPassword",
        type: "string",
      },
    ],
    name: "registerManufacturer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "userExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_userId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_password",
        type: "string",
      },
    ],
    name: "verifyCredentials",
    outputs: [
      {
        internalType: "bool",
        name: "isValid",
        type: "bool",
      },
      {
        internalType: "enum UserAuth.UserRole",
        name: "role",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const MedicineTrackingABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "batchId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "manufacturerId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "hospitalId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "BatchCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "batchId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "reason",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "BatchFlagged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "string",
        name: "batchId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "enum MedicineTracking.BatchStatus",
        name: "status",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "string",
        name: "location",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
    ],
    name: "BatchStatusUpdated",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "batchExists",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_manufacturerId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_hospitalId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_medicineName",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "_quantity",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_expiryDate",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "_initialLocation",
        type: "string",
      },
    ],
    name: "createBatch",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_batchId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_reason",
        type: "string",
      },
    ],
    name: "flagBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_batchId",
        type: "string",
      },
    ],
    name: "getBatch",
    outputs: [
      {
        internalType: "string",
        name: "manufacturerId",
        type: "string",
      },
      {
        internalType: "string",
        name: "hospitalId",
        type: "string",
      },
      {
        internalType: "string",
        name: "medicineName",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "quantity",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "expiryDate",
        type: "uint256",
      },
      {
        internalType: "enum MedicineTracking.BatchStatus",
        name: "status",
        type: "uint8",
      },
      {
        internalType: "string",
        name: "currentLocation",
        type: "string",
      },
      {
        internalType: "bool",
        name: "isFlagged",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_manufacturerId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_locationId",
        type: "string",
      },
    ],
    name: "getLocationDetails",
    outputs: [
      {
        internalType: "enum MedicineTracking.LocationType",
        name: "locationType",
        type: "uint8",
      },
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "bool",
        name: "isActive",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "registeredAt",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_manufacturerId",
        type: "string",
      },
      {
        internalType: "string",
        name: "_locationId",
        type: "string",
      },
      {
        internalType: "enum MedicineTracking.LocationType",
        name: "_locationType",
        type: "uint8",
      },
      {
        internalType: "string",
        name: "_locationName",
        type: "string",
      },
    ],
    name: "registerLocation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_batchId",
        type: "string",
      },
      {
        internalType: "enum MedicineTracking.BatchStatus",
        name: "_newStatus",
        type: "uint8",
      },
      {
        internalType: "string",
        name: "_location",
        type: "string",
      },
      {
        internalType: "string",
        name: "_updatedBy",
        type: "string",
      },
    ],
    name: "updateBatchStatus",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
