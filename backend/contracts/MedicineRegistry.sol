// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MedicineRegistry
 * @dev Core contract managing medicine batch lifecycle.
 *
 * Status flow enforcement: CREATED -> SHIPPED -> SORTED -> DELIVERED -> VERIFIED
 * Any failed check results in FLAGGED with a reason enum.
 *
 * Off-chain data (images, location coordinates) are stored in MySQL.
 * On-chain only stores: hash references, enums, IDs, timestamps.
 */
contract MedicineRegistry {

    // ─── Enums ────────────────────────────────────────────────────────────────

    enum BatchStatus {
        CREATED,      // 0
        SHIPPED,      // 1
        SORTED,       // 2
        DISTRIBUTED,    // 3
        DELIVERED,    // 4
        VERIFIED,     // 5
        FLAGGED       // 6
    }

    enum FlagReason {
        NONE,                    // 0
        NEAR_EXPIRY,             // 1 – update within 1 month of expiry
        OUTSIDE_REGISTERED_LOCATION, // 2 – GPS not within registered location
        DUPLICATE_LOCATION_UPDATE,   // 3 – same batch updated at same location twice
        INVALID_STATUS_ORDER,    // 4 – tried to skip or reverse status
        HOSPITAL_FLAGGED         // 5 – manually flagged by hospital
    }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct StatusUpdate {
        BatchStatus status;
        FlagReason flagReason;
        string locationId;        // registered location used
        bytes32 imageProofHash;   // keccak256 of off-chain image path/URL
        uint256 updatedAt;
        string updatedBy;         // manufacturerId or hospitalId
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

    // batchId => MedicineBatch
    mapping(string => MedicineBatch) private batches;

    // batchId => StatusUpdate[]
    mapping(string => StatusUpdate[]) private batchHistory;

    // batchId => locationId => updated (for duplicate detection)
    mapping(string => mapping(string => bool)) private batchLocationUpdated;

    // All batch IDs for enumeration
    string[] private allBatchIds;

    // manufacturerId => batchIds[]
    mapping(string => string[]) private manufacturerBatches;

    // hospitalId => batchIds[]
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

    constructor() {
        owner = msg.sender;
    }

    // ─── Batch ID Generation ──────────────────────────────────────────────────

    /**
     * @dev Generate a deterministic batch ID from batch parameters.
     *      Called off-chain to get the ID before creating.
     */
    function generateBatchId(
        string memory _medicineId,
        string memory _manufacturerId,
        string memory _hospitalId,
        uint256 _expiryDate,
        uint256 _nonce
    ) external pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _medicineId,
                _manufacturerId,
                _hospitalId,
                _expiryDate,
                _nonce
            )
        );
    }

    // ─── Create Batch ─────────────────────────────────────────────────────────

    /**
     * @dev Create a new medicine batch. Called by manufacturer.
     * @param _batchId Pre-computed batch ID (bytes32 converted to hex string)
     * @param _medicineId Medicine product identifier
     * @param _medicineName Human-readable medicine name
     * @param _hospitalId Destination hospital
     * @param _manufacturerId Creating manufacturer
     * @param _expiryDate Unix timestamp of expiry
     * @param _batchDataHash Hash of the batch data stored off-chain
     */
    function createBatch(
        string memory _batchId,
        string memory _medicineId,
        string memory _medicineName,
        string memory _hospitalId,
        string memory _manufacturerId,
        uint256 _expiryDate,
        bytes32 _batchDataHash
    ) external {
        require(!batches[_batchId].exists, "Batch ID already exists");
        require(_expiryDate > block.timestamp, "Expiry must be in the future");

        batches[_batchId] = MedicineBatch({
            batchId: _batchId,
            medicineId: _medicineId,
            medicineName: _medicineName,
            hospitalId: _hospitalId,
            manufacturerId: _manufacturerId,
            expiryDate: _expiryDate,
            createdAt: block.timestamp,
            currentStatus: BatchStatus.CREATED,
            currentFlagReason: FlagReason.NONE,
            exists: true,
            updateCount: 0,
            batchDataHash: _batchDataHash
        });

        // Record creation as first history entry
        batchHistory[_batchId].push(StatusUpdate({
            status: BatchStatus.CREATED,
            flagReason: FlagReason.NONE,
            locationId: "",
            imageProofHash: bytes32(0),
            updatedAt: block.timestamp,
            updatedBy: _manufacturerId
        }));

        allBatchIds.push(_batchId);
        manufacturerBatches[_manufacturerId].push(_batchId);
        hospitalBatches[_hospitalId].push(_batchId);

        emit BatchCreated(
            _batchId,
            _medicineId,
            _manufacturerId,
            _hospitalId,
            _expiryDate,
            block.timestamp
        );
    }

    // ─── Update Batch Status ──────────────────────────────────────────────────

    /**
     * @dev Update batch status with all validation checks.
     *      Checks (in order):
     *      1. Status must follow CREATED->SHIPPED->SORTED->DELIVERED
     *      2. Current time must NOT be within 1 month of expiry
     *      3. LocationId must not have been used for this batch before
     *      4. Geolocation check is done OFF-CHAIN; result passed as _locationValid
     *         (off-chain API checks GPS coords against registered location radius)
     *
     * If any check fails, status becomes FLAGGED with appropriate reason.
     *
     * @param _batchId Target batch
     * @param _newStatus Desired next status (1=SHIPPED, 2=SORTED, 3=DELIVERED)
     * @param _locationId Registered location where update happens
     * @param _imageProofHash keccak256 of image stored off-chain
     * @param _locationValid Off-chain geolocation check result
     * @param _updatedBy Manufacturer ID performing the update
     */
    function updateBatchStatus(
        string memory _batchId,
        uint8 _newStatus,
        string memory _locationId,
        bytes32 _imageProofHash,
        bool _locationValid,
        string memory _updatedBy
    ) external batchExists(_batchId) {
        MedicineBatch storage batch = batches[_batchId];

        // Batch must not already be VERIFIED or permanently FLAGGED
        require(
            batch.currentStatus != BatchStatus.VERIFIED,
            "Batch already verified"
        );

        BatchStatus desiredStatus = BatchStatus(_newStatus);
        FlagReason flagReason = FlagReason.NONE;
        BatchStatus finalStatus = desiredStatus;

        // ── Check 1: Status order validation ──────────────────────────────────
        // CREATED(0)->SHIPPED(1)->SORTED(2)->DISTRIBUTED(3)->DELIVERED(4) must be sequential +1
        if (uint8(desiredStatus) != uint8(batch.currentStatus) + 1
            || uint8(desiredStatus) > 4) {
            flagReason = FlagReason.INVALID_STATUS_ORDER;
            finalStatus = BatchStatus.FLAGGED;
        }

        // ── Check 2: Near expiry (within 30 days) ─────────────────────────────
        if (flagReason == FlagReason.NONE) {
            if (block.timestamp >= batch.expiryDate - 30 days) {
                flagReason = FlagReason.NEAR_EXPIRY;
                finalStatus = BatchStatus.FLAGGED;
            }
        }

        // ── Check 3: Duplicate location update ───────────────────────────────
        if (flagReason == FlagReason.NONE) {
            if (batchLocationUpdated[_batchId][_locationId]) {
                flagReason = FlagReason.DUPLICATE_LOCATION_UPDATE;
                finalStatus = BatchStatus.FLAGGED;
            }
        }

        // ── Check 4: Geolocation valid (passed from off-chain) ────────────────
        if (flagReason == FlagReason.NONE) {
            if (!_locationValid) {
                flagReason = FlagReason.OUTSIDE_REGISTERED_LOCATION;
                finalStatus = BatchStatus.FLAGGED;
            }
        }

        // ── Mark location as used (even if flagged, to prevent retry abuse) ───
        if (bytes(_locationId).length > 0) {
            batchLocationUpdated[_batchId][_locationId] = true;
        }

        // ── Apply status update ───────────────────────────────────────────────
        batch.currentStatus = finalStatus;
        batch.currentFlagReason = flagReason;
        batch.updateCount += 1;

        batchHistory[_batchId].push(StatusUpdate({
            status: finalStatus,
            flagReason: flagReason,
            locationId: _locationId,
            imageProofHash: _imageProofHash,
            updatedAt: block.timestamp,
            updatedBy: _updatedBy
        }));

        emit BatchStatusUpdated(
            _batchId,
            finalStatus,
            flagReason,
            _locationId,
            _imageProofHash,
            block.timestamp
        );

        if (finalStatus == BatchStatus.FLAGGED) {
            emit BatchFlagged(_batchId, flagReason, _updatedBy, block.timestamp);
        }
    }

    // ─── Hospital Actions ─────────────────────────────────────────────────────

    /**
     * @dev Hospital verifies a delivered batch.
     */
    function verifyBatch(string memory _batchId, string memory _hospitalId)
        external
        batchExists(_batchId)
    {
        MedicineBatch storage batch = batches[_batchId];
        require(
            keccak256(bytes(batch.hospitalId)) == keccak256(bytes(_hospitalId)),
            "Not your batch"
        );
        require(
            batch.currentStatus == BatchStatus.DELIVERED,
            "Batch must be DELIVERED before verification"
        );

        batch.currentStatus = BatchStatus.VERIFIED;
        batch.currentFlagReason = FlagReason.NONE;
        batch.updateCount += 1;

        batchHistory[_batchId].push(StatusUpdate({
            status: BatchStatus.VERIFIED,
            flagReason: FlagReason.NONE,
            locationId: "",
            imageProofHash: bytes32(0),
            updatedAt: block.timestamp,
            updatedBy: _hospitalId
        }));

        emit BatchVerified(_batchId, _hospitalId, block.timestamp);
    }

    /**
     * @dev Hospital manually flags a batch.
     */
    function flagBatch(string memory _batchId, string memory _hospitalId)
        external
        batchExists(_batchId)
    {
        MedicineBatch storage batch = batches[_batchId];
        require(
            keccak256(bytes(batch.hospitalId)) == keccak256(bytes(_hospitalId)),
            "Not your batch"
        );

        batch.currentStatus = BatchStatus.FLAGGED;
        batch.currentFlagReason = FlagReason.HOSPITAL_FLAGGED;
        batch.updateCount += 1;

        batchHistory[_batchId].push(StatusUpdate({
            status: BatchStatus.FLAGGED,
            flagReason: FlagReason.HOSPITAL_FLAGGED,
            locationId: "",
            imageProofHash: bytes32(0),
            updatedAt: block.timestamp,
            updatedBy: _hospitalId
        }));

        emit BatchFlagged(_batchId, FlagReason.HOSPITAL_FLAGGED, _hospitalId, block.timestamp);
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
            b.medicineId,
            b.medicineName,
            b.hospitalId,
            b.manufacturerId,
            b.expiryDate,
            b.createdAt,
            uint8(b.currentStatus),
            uint8(b.currentFlagReason),
            b.exists
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

        statuses = new uint8[](len);
        flagReasons = new uint8[](len);
        locationIds = new string[](len);
        imageHashes = new bytes32[](len);
        timestamps = new uint256[](len);
        updatedBys = new string[](len);

        for (uint256 i = 0; i < len; i++) {
            statuses[i] = uint8(history[i].status);
            flagReasons[i] = uint8(history[i].flagReason);
            locationIds[i] = history[i].locationId;
            imageHashes[i] = history[i].imageProofHash;
            timestamps[i] = history[i].updatedAt;
            updatedBys[i] = history[i].updatedBy;
        }
    }

    function getManufacturerBatches(string memory _manufacturerId)
        external
        view
        returns (string[] memory)
    {
        return manufacturerBatches[_manufacturerId];
    }

    function getHospitalBatches(string memory _hospitalId)
        external
        view
        returns (string[] memory)
    {
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
