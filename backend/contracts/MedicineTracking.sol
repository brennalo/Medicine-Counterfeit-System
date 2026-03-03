// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MedicineTracking {
    enum BatchStatus { 
        None,
        OrderCreated, 
        Shipped, 
        Distributed, 
        Sorted, 
        Delivered, 
        Verified,
        Flagged 
    }
    
    enum LocationType { None, Factory, DistributionCentre, SortingCentre }
    
    struct Location {
        string locationId;
        LocationType locationType;
        string name;
        bool isActive;
        uint256 registeredAt;
    }
    
    struct MedicineBatch {
        string batchId;
        string manufacturerId;
        string hospitalId;
        string medicineName;
        uint256 quantity;
        uint256 expiryDate;
        BatchStatus status;
        string currentLocation;
        uint256 createdAt;
        uint256 lastUpdated;
        bool isFlagged;
    }
    
    struct StatusUpdate {
        BatchStatus status;
        string location;
        uint256 timestamp;
        string updatedBy;
    }
    
    // Mappings
    mapping(string => MedicineBatch) public batches;
    mapping(string => bool) public batchExists;
    mapping(string => StatusUpdate[]) public batchHistory;
    
    // Manufacturer locations - mapping(manufacturerId => mapping(locationId => Location))
    mapping(string => mapping(string => Location)) public manufacturerLocations;
    mapping(string => string[]) public manufacturerLocationIds;
    
    // Track scanned locations for each batch to prevent duplicates
    mapping(string => mapping(string => uint256)) public batchLocationScans;
    
    // Events
    event BatchCreated(string indexed batchId, string manufacturerId, string hospitalId, uint256 timestamp);
    event BatchStatusUpdated(string indexed batchId, BatchStatus status, string location, uint256 timestamp);
    event BatchFlagged(string indexed batchId, string reason, uint256 timestamp);
    event LocationRegistered(string indexed manufacturerId, string locationId, LocationType locationType);
    
    // Batch counter for unique ID generation
    uint256 private batchCounter;
    
    constructor() {
        batchCounter = 0;
    }
    
    // Register a location for manufacturer
    function registerLocation(
        string memory _manufacturerId,
        string memory _locationId,
        LocationType _locationType,
        string memory _locationName
    ) public {
        require(bytes(_manufacturerId).length > 0, "Manufacturer ID required");
        require(bytes(_locationId).length > 0, "Location ID required");
        require(_locationType != LocationType.None, "Invalid location type");
        require(!manufacturerLocations[_manufacturerId][_locationId].isActive, "Location already registered");
        
        manufacturerLocations[_manufacturerId][_locationId] = Location({
            locationId: _locationId,
            locationType: _locationType,
            name: _locationName,
            isActive: true,
            registeredAt: block.timestamp
        });
        
        manufacturerLocationIds[_manufacturerId].push(_locationId);
        
        emit LocationRegistered(_manufacturerId, _locationId, _locationType);
    }
    
    // Generate unique batch ID
    function generateBatchId() private returns (string memory) {
        batchCounter++;
        return string(abi.encodePacked("BATCH-", uint2str(block.timestamp), "-", uint2str(batchCounter)));
    }
    
    // Create new medicine batch
    function createBatch(
        string memory _manufacturerId,
        string memory _hospitalId,
        string memory _medicineName,
        uint256 _quantity,
        uint256 _expiryDate,
        string memory _initialLocation
    ) public returns (string memory) {
        require(bytes(_manufacturerId).length > 0, "Manufacturer ID required");
        require(bytes(_hospitalId).length > 0, "Hospital ID required");
        require(bytes(_medicineName).length > 0, "Medicine name required");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_expiryDate > block.timestamp, "Expiry date must be in the future");
        
        // Verify location is registered
        require(manufacturerLocations[_manufacturerId][_initialLocation].isActive, "Invalid location");
        
        string memory batchId = generateBatchId();
        
        batches[batchId] = MedicineBatch({
            batchId: batchId,
            manufacturerId: _manufacturerId,
            hospitalId: _hospitalId,
            medicineName: _medicineName,
            quantity: _quantity,
            expiryDate: _expiryDate,
            status: BatchStatus.OrderCreated,
            currentLocation: _initialLocation,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            isFlagged: false
        });
        
        batchExists[batchId] = true;
        
        // Record first status update
        batchHistory[batchId].push(StatusUpdate({
            status: BatchStatus.OrderCreated,
            location: _initialLocation,
            timestamp: block.timestamp,
            updatedBy: _manufacturerId
        }));
        
        // Record location scan
        batchLocationScans[batchId][_initialLocation] = block.timestamp;
        
        emit BatchCreated(batchId, _manufacturerId, _hospitalId, block.timestamp);
        emit BatchStatusUpdated(batchId, BatchStatus.OrderCreated, _initialLocation, block.timestamp);
        
        return batchId;
    }
    
    // Update batch status with validation
    function updateBatchStatus(
        string memory _batchId,
        BatchStatus _newStatus,
        string memory _location,
        string memory _updatedBy
    ) public {
        require(batchExists[_batchId], "Batch does not exist");
        require(!batches[_batchId].isFlagged, "Batch is flagged and cannot be updated");
        
        MedicineBatch storage batch = batches[_batchId];
        
        // Verify expiry date
        require(block.timestamp < batch.expiryDate, "Batch has expired");
        
        // Verify location is registered for manufacturer
        if (_newStatus != BatchStatus.Verified && _newStatus != BatchStatus.Flagged) {
            require(
                manufacturerLocations[batch.manufacturerId][_location].isActive,
                "Location not registered for this manufacturer"
            );
            
            // Check for duplicate scans at same location
            if (batchLocationScans[_batchId][_location] > 0) {
                // Already scanned at this location - flag as suspicious
                batch.isFlagged = true;
                batch.status = BatchStatus.Flagged;
                emit BatchFlagged(_batchId, "Duplicate scan at same location", block.timestamp);
                return;
            }
            
            // Record this scan
            batchLocationScans[_batchId][_location] = block.timestamp;
        }
        
        // Update batch
        batch.status = _newStatus;
        batch.currentLocation = _location;
        batch.lastUpdated = block.timestamp;
        
        if (_newStatus == BatchStatus.Flagged) {
            batch.isFlagged = true;
        }
        
        // Record status update in history
        batchHistory[_batchId].push(StatusUpdate({
            status: _newStatus,
            location: _location,
            timestamp: block.timestamp,
            updatedBy: _updatedBy
        }));
        
        emit BatchStatusUpdated(_batchId, _newStatus, _location, block.timestamp);
    }
    
    // Hospital flags a batch
    function flagBatch(string memory _batchId, string memory _reason) public {
        require(batchExists[_batchId], "Batch does not exist");
        
        MedicineBatch storage batch = batches[_batchId];
        batch.isFlagged = true;
        batch.status = BatchStatus.Flagged;
        batch.lastUpdated = block.timestamp;
        
        emit BatchFlagged(_batchId, _reason, block.timestamp);
    }
    
    // Get batch information
    function getBatch(string memory _batchId) 
        public 
        view 
        returns (
            string memory manufacturerId,
            string memory hospitalId,
            string memory medicineName,
            uint256 quantity,
            uint256 expiryDate,
            BatchStatus status,
            string memory currentLocation,
            bool isFlagged
        ) 
    {
        require(batchExists[_batchId], "Batch does not exist");
        
        MedicineBatch memory batch = batches[_batchId];
        return (
            batch.manufacturerId,
            batch.hospitalId,
            batch.medicineName,
            batch.quantity,
            batch.expiryDate,
            batch.status,
            batch.currentLocation,
            batch.isFlagged
        );
    }
    
    // Get batch history
    function getBatchHistory(string memory _batchId) 
        public 
        view 
        returns (StatusUpdate[] memory) 
    {
        require(batchExists[_batchId], "Batch does not exist");
        return batchHistory[_batchId];
    }
    
    // Get manufacturer locations
    function getManufacturerLocations(string memory _manufacturerId) 
        public 
        view 
        returns (string[] memory) 
    {
        return manufacturerLocationIds[_manufacturerId];
    }
    
    // Get location details
    function getLocationDetails(string memory _manufacturerId, string memory _locationId)
        public
        view
        returns (
            LocationType locationType,
            string memory name,
            bool isActive,
            uint256 registeredAt
        )
    {
        Location memory loc = manufacturerLocations[_manufacturerId][_locationId];
        return (loc.locationType, loc.name, loc.isActive, loc.registeredAt);
    }
    
    // Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            k--;
            bstr[k] = bytes1(uint8(48 + j % 10));
            j /= 10;
        }
        return string(bstr);
    }
}
