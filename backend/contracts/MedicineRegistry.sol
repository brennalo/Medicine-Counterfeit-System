// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUserRegistry {
    enum Role { NONE, HOSPITAL, MANUFACTURER }
    function addressToUserId(address wallet) external view returns (string memory);
    function addressToRole(address wallet) external view returns (Role);
}

/**
 * @title MedicineRegistry
 * @dev Core contract managing medicine batch lifecycle.
 *
 * RBAC enforced via msg.sender:
 *   - Only registered MANUFACTURERs can create / update batches.
 *   - Only registered HOSPITALs can verify / flag batches.
 *   - Manufacturers can only update their OWN batches (identity binding).
 *   - Hospitals can only act on batches assigned to THEM.
 *
 * Caller identity (userId) is always resolved from msg.sender through
 * UserRegistry — it is never accepted as a trusted function parameter.
 *
 * Status flow: CREATED(0)->SHIPPED(1)->SORTED(2)->DISTRIBUTED(3)->DELIVERED(4)->VERIFIED(5)
 * Any failed validation check results in FLAGGED(6) with a reason enum.
 */
contract MedicineRegistry {

    // ─── Enums ────────────────────────────────────────────────────────────────

    enum BatchStatus {
        CREATED,      // 0
        SHIPPED,      // 1
        SORTED,       // 2
        DISTRIBUTED,  // 3
        DELIVERED,    // 4
        VERIFIED,     // 5
        FLAGGED       // 6
    }

    enum FlagReason {
        NONE,                         // 0
        NEAR_EXPIRY,                  // 1
        OUTSIDE_REGISTERED_LOCATION,  // 2
        DUPLICATE_LOCATION_UPDATE,    // 3
        INVALID_STATUS_ORDER,         // 4
        HOSPITAL_FLAGGED              // 5
    }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct StatusUpdate {
        BatchStatus status;
        FlagReason flagReason;
        string locationId;
        bytes32 imageProofHash;
        uint256 updatedAt;
        string updatedBy;       // userId resolved from msg.sender at call time
    }

    struct MedicineBatch {
        string batchId;
        string medicineId;
        string medicineName;
        string hospitalId;
        string manufacturerId;
        uint256 expiryDate;
        uint256 createdAt;
        BatchStatus currentStatus;
        FlagReason currentFlagReason;
        bool exists;
        uint256 updateCount;
        bytes32 batchDataHash;
    }

    // ─── Storage ──────────────────────────────────────────────────────────────

    IUserRegistry public userRegistry;

    mapping(string => MedicineBatch) private batches;
    mapping(string => StatusUpdate[]) private batchHistory;
    mapping(string => mapping(string => bool)) private batchLocationUpdated;

    string[] private allBatchIds;
    mapping(string => string[]) private manufacturerBatches;
    mapping(string => string[]) private hospitalBatches;

    address public owner;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BatchCreated(
        string indexed batchId,
        string medicineId,
        string manufacturerId,
        string hospitalId,
        uint256 expiryDate,
        uint256 timestamp
    );

    event BatchStatusUpdated(
        string indexed batchId,
        BatchStatus newStatus,
        FlagReason flagReason,
        string locationId,
        bytes32 imageProofHash,
        uint256 timestamp
    );

    event BatchFlagged(
        string indexed batchId,
        FlagReason reason,
        string updatedBy,
        uint256 timestamp
    );

    event BatchVerified(
        string indexed batchId,
        string hospitalId,
        uint256 timestamp
    );

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier batchExists(string memory _batchId) {
        require(batches[_batchId].exists, "Batch does not exist");
        _;
    }

    /**
     * @dev Only registered MANUFACTURERs may call.
     *      Reverts if msg.sender is not in UserRegistry with MANUFACTURER role.
     */
    modifier onlyManufacturer() {
        require(
            userRegistry.addressToRole(msg.sender) == IUserRegistry.Role.MANUFACTURER,
            "Caller is not a registered manufacturer"
        );
        _;
    }

    /**
     * @dev Only registered HOSPITALs may call.
     *      Reverts if msg.sender is not in UserRegistry with HOSPITAL role.
     */
    modifier onlyHospital() {
        require(
            userRegistry.addressToRole(msg.sender) == IUserRegistry.Role.HOSPITAL,
            "Caller is not a registered hospital"
        );
        _;
    }

    /**
     * @dev Manufacturer identity binding.
     *      msg.sender's userId must match the batch's manufacturerId.
     *      Prevents one manufacturer from updating another's batch,
     *      even if they somehow obtain a valid batch ID.
     */
    modifier onlyBatchManufacturer(string memory _batchId) {
        string memory callerId = userRegistry.addressToUserId(msg.sender);
        require(
            keccak256(bytes(batches[_batchId].manufacturerId)) == keccak256(bytes(callerId)),
            "Caller is not the batch manufacturer"
        );
        _;
    }

    /**
     * @dev Hospital identity binding.
     *      msg.sender's userId must match the batch's hospitalId.
     *      Prevents a hospital from acting on batches assigned to another hospital.
     */
    modifier onlyBatchHospital(string memory _batchId) {
        string memory callerId = userRegistry.addressToUserId(msg.sender);
        require(
            keccak256(bytes(batches[_batchId].hospitalId)) == keccak256(bytes(callerId)),
            "Batch not assigned to your hospital"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _userRegistry Address of the deployed UserRegistry contract.
     */
    constructor(address _userRegistry) {
        owner = msg.sender;
        userRegistry = IUserRegistry(_userRegistry);
    }

    // ─── Batch ID Generation ──────────────────────────────────────────────────

    function generateBatchId(
        string memory _medicineId,
        string memory _manufacturerId,
        string memory _hospitalId,
        uint256 _expiryDate,
        uint256 _nonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            _medicineId, _manufacturerId, _hospitalId, _expiryDate, _nonce
        ));
    }

    // ─── Create Batch ─────────────────────────────────────────────────────────

    /**
     * @dev Create a new medicine batch.
     *      Caller must be a registered MANUFACTURER (enforced by onlyManufacturer).
     *      manufacturerId is resolved from msg.sender — NOT accepted as a parameter.
     *
     * @param _batchId       Pre-computed batch ID
     * @param _medicineId    Medicine product identifier
     * @param _medicineName  Human-readable medicine name
     * @param _hospitalId    Destination hospital userId
     * @param _expiryDate    Unix timestamp of expiry
     * @param _batchDataHash keccak256 of off-chain batch metadata for integrity
     */
    function createBatch(
        string memory _batchId,
        string memory _medicineId,
        string memory _medicineName,
        string memory _hospitalId,
        uint256 _expiryDate,
        bytes32 _batchDataHash
    ) external onlyManufacturer {
        require(!batches[_batchId].exists, "Batch ID already exists");
        require(_expiryDate > block.timestamp, "Expiry must be in the future");

        // Resolve manufacturerId from msg.sender — never trusted from input
        string memory manufacturerId = userRegistry.addressToUserId(msg.sender);

        batches[_batchId] = MedicineBatch({
            batchId: _batchId,
            medicineId: _medicineId,
            medicineName: _medicineName,
            hospitalId: _hospitalId,
            manufacturerId: manufacturerId,
            expiryDate: _expiryDate,
            createdAt: block.timestamp,
            currentStatus: BatchStatus.CREATED,
            currentFlagReason: FlagReason.NONE,
            exists: true,
            updateCount: 0,
            batchDataHash: _batchDataHash
        });

        batchHistory[_batchId].push(StatusUpdate({
            status: BatchStatus.CREATED,
            flagReason: FlagReason.NONE,
            locationId: "",
            imageProofHash: bytes32(0),
            updatedAt: block.timestamp,
            updatedBy: manufacturerId
        }));

        allBatchIds.push(_batchId);
        manufacturerBatches[manufacturerId].push(_batchId);
        hospitalBatches[_hospitalId].push(_batchId);

        emit BatchCreated(_batchId, _medicineId, manufacturerId, _hospitalId, _expiryDate, block.timestamp);
    }

    // ─── Update Batch Status ──────────────────────────────────────────────────

    /**
     * @dev Update batch status with all validation checks.
     *      Caller must be the MANUFACTURER who owns this batch.
     *      updatedBy is resolved from msg.sender — NOT accepted as a parameter.
     *
     * Checks (in order):
     *   1. Status must be sequential +1 (max DELIVERED = 4)
     *   2. Must not be within 30 days of expiry
     *   3. LocationId must not have been used for this batch before
     *   4. Off-chain geolocation result (_locationValid) must be true
     *
     * Any failed check → status becomes FLAGGED with appropriate FlagReason.
     */
    function updateBatchStatus(
        string memory _batchId,
        uint8 _newStatus,
        string memory _locationId,
        bytes32 _imageProofHash,
        bool _locationValid
        // _updatedBy REMOVED — resolved from msg.sender
    ) external onlyManufacturer onlyBatchManufacturer(_batchId) batchExists(_batchId) {
        MedicineBatch storage batch = batches[_batchId];

        require(
            batch.currentStatus != BatchStatus.VERIFIED,
            "Batch already verified"
        );

        string memory callerId = userRegistry.addressToUserId(msg.sender);

        BatchStatus desiredStatus = BatchStatus(_newStatus);
        FlagReason flagReason = FlagReason.NONE;
        BatchStatus finalStatus = desiredStatus;

        // ── Check 1: Status order ─────────────────────────────────────────────
        if (uint8(desiredStatus) != uint8(batch.currentStatus) + 1
            || uint8(desiredStatus) > 4) {
            flagReason = FlagReason.INVALID_STATUS_ORDER;
            finalStatus = BatchStatus.FLAGGED;
        }

        // ── Check 2: Near expiry ──────────────────────────────────────────────
        if (flagReason == FlagReason.NONE) {
            if (block.timestamp >= batch.expiryDate - 30 days) {
                flagReason = FlagReason.NEAR_EXPIRY;
                finalStatus = BatchStatus.FLAGGED;
            }
        }

        // ── Check 3: Duplicate location ───────────────────────────────────────
        if (flagReason == FlagReason.NONE) {
            if (batchLocationUpdated[_batchId][_locationId]) {
                flagReason = FlagReason.DUPLICATE_LOCATION_UPDATE;
                finalStatus = BatchStatus.FLAGGED;
            }
        }

        // ── Check 4: Geolocation (off-chain result passed in) ─────────────────
        if (flagReason == FlagReason.NONE) {
            if (!_locationValid) {
                flagReason = FlagReason.OUTSIDE_REGISTERED_LOCATION;
                finalStatus = BatchStatus.FLAGGED;
            }
        }

        // Mark location as used even if flagged (prevents retry abuse)
        if (bytes(_locationId).length > 0) {
            batchLocationUpdated[_batchId][_locationId] = true;
        }

        batch.currentStatus = finalStatus;
        batch.currentFlagReason = flagReason;
        batch.updateCount += 1;

        batchHistory[_batchId].push(StatusUpdate({
            status: finalStatus,
            flagReason: flagReason,
            locationId: _locationId,
            imageProofHash: _imageProofHash,
            updatedAt: block.timestamp,
            updatedBy: callerId
        }));

        emit BatchStatusUpdated(_batchId, finalStatus, flagReason, _locationId, _imageProofHash, block.timestamp);

        if (finalStatus == BatchStatus.FLAGGED) {
            emit BatchFlagged(_batchId, flagReason, callerId, block.timestamp);
        }
    }

    // ─── Hospital Actions ─────────────────────────────────────────────────────

    /**
     * @dev Hospital verifies a delivered batch.
     *      Caller must be the HOSPITAL this batch is assigned to.
     *      hospitalId resolved from msg.sender — NOT accepted as a parameter.
     */
    function verifyBatch(string memory _batchId)
        external
        onlyHospital
        onlyBatchHospital(_batchId)
        batchExists(_batchId)
    {
        MedicineBatch storage batch = batches[_batchId];
        require(
            batch.currentStatus == BatchStatus.DELIVERED,
            "Batch must be DELIVERED before verification"
        );

        string memory hospitalId = userRegistry.addressToUserId(msg.sender);

        batch.currentStatus = BatchStatus.VERIFIED;
        batch.currentFlagReason = FlagReason.NONE;
        batch.updateCount += 1;

        batchHistory[_batchId].push(StatusUpdate({
            status: BatchStatus.VERIFIED,
            flagReason: FlagReason.NONE,
            locationId: "",
            imageProofHash: bytes32(0),
            updatedAt: block.timestamp,
            updatedBy: hospitalId
        }));

        emit BatchVerified(_batchId, hospitalId, block.timestamp);
    }

    /**
     * @dev Hospital manually flags a batch.
     *      Caller must be the HOSPITAL this batch is assigned to.
     */
    function flagBatch(string memory _batchId)
        external
        onlyHospital
        onlyBatchHospital(_batchId)
        batchExists(_batchId)
    {
        MedicineBatch storage batch = batches[_batchId];
        string memory hospitalId = userRegistry.addressToUserId(msg.sender);

        batch.currentStatus = BatchStatus.FLAGGED;
        batch.currentFlagReason = FlagReason.HOSPITAL_FLAGGED;
        batch.updateCount += 1;

        batchHistory[_batchId].push(StatusUpdate({
            status: BatchStatus.FLAGGED,
            flagReason: FlagReason.HOSPITAL_FLAGGED,
            locationId: "",
            imageProofHash: bytes32(0),
            updatedAt: block.timestamp,
            updatedBy: hospitalId
        }));

        emit BatchFlagged(_batchId, FlagReason.HOSPITAL_FLAGGED, hospitalId, block.timestamp);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getBatch(string memory _batchId)
        external
        view
        returns (
            string memory medicineId,
            string memory medicineName,
            string memory hospitalId,
            string memory manufacturerId,
            uint256 expiryDate,
            uint256 createdAt,
            uint8 currentStatus,
            uint8 currentFlagReason,
            bool exists
        )
    {
        MedicineBatch storage b = batches[_batchId];
        return (
            b.medicineId, b.medicineName, b.hospitalId, b.manufacturerId,
            b.expiryDate, b.createdAt,
            uint8(b.currentStatus), uint8(b.currentFlagReason), b.exists
        );
    }

    function getBatchHistory(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (
            uint8[] memory statuses,
            uint8[] memory flagReasons,
            string[] memory locationIds,
            bytes32[] memory imageHashes,
            uint256[] memory timestamps,
            string[] memory updatedBys
        )
    {
        StatusUpdate[] storage history = batchHistory[_batchId];
        uint256 len = history.length;

        statuses    = new uint8[](len);
        flagReasons = new uint8[](len);
        locationIds = new string[](len);
        imageHashes = new bytes32[](len);
        timestamps  = new uint256[](len);
        updatedBys  = new string[](len);

        for (uint256 i = 0; i < len; i++) {
            statuses[i]    = uint8(history[i].status);
            flagReasons[i] = uint8(history[i].flagReason);
            locationIds[i] = history[i].locationId;
            imageHashes[i] = history[i].imageProofHash;
            timestamps[i]  = history[i].updatedAt;
            updatedBys[i]  = history[i].updatedBy;
        }
    }

    function getManufacturerBatches(string memory _manufacturerId) external view returns (string[] memory) {
        return manufacturerBatches[_manufacturerId];
    }

    function getHospitalBatches(string memory _hospitalId) external view returns (string[] memory) {
        return hospitalBatches[_hospitalId];
    }

    function getAllBatchIds() external view returns (string[] memory) {
        return allBatchIds;
    }

    function batchExistsPublic(string memory _batchId) external view returns (bool) {
        return batches[_batchId].exists;
    }

    function getBatchDataHash(string memory _batchId)
        external
        view
        batchExists(_batchId)
        returns (bytes32)
    {
        return batches[_batchId].batchDataHash;
    }
}
