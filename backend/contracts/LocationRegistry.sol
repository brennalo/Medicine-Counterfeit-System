// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LocationRegistry
 * @dev Stores location metadata hash on-chain; actual coordinates/address in MySQL.
 *      locationDataHash = keccak256(name + locationType + address + lat + lng)
 *      This allows verification that off-chain data hasn't been tampered with.
 */
contract LocationRegistry {
    enum LocationType { FACTORY, DISTRIBUTION_CENTER, SORTING_CENTER }

    struct Location {
        string locationId;
        string name;
        LocationType locationType;
        bytes32 locationDataHash; // hash of full off-chain record (address + coordinates)
        string manufacturerId;
        bool exists;
        uint256 registeredAt;
    }

    // locationId => Location
    mapping(string => Location) private locations;
    // manufacturerId => locationIds[]
    mapping(string => string[]) private manufacturerLocations;

    string[] private allLocationIds;
    address public owner;

    event LocationRegistered(
        string indexed locationId,
        string indexed manufacturerId,
        LocationType locationType,
        bytes32 dataHash,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Register a verified location.
     * @param _locationId Unique location identifier
     * @param _name Location name
     * @param _locationType 0=FACTORY, 1=DISTRIBUTION_CENTER, 2=SORTING_CENTER
     * @param _locationDataHash keccak256 hash of the off-chain data row
     * @param _manufacturerId Owner manufacturer
     */
    function registerLocation(
        string memory _locationId,
        string memory _name,
        uint8 _locationType,
        bytes32 _locationDataHash,
        string memory _manufacturerId
    ) external {
        require(!locations[_locationId].exists, "Location already registered");
        require(_locationType <= 2, "Invalid location type");

        locations[_locationId] = Location({
            locationId: _locationId,
            name: _name,
            locationType: LocationType(_locationType),
            locationDataHash: _locationDataHash,
            manufacturerId: _manufacturerId,
            exists: true,
            registeredAt: block.timestamp
        });

        manufacturerLocations[_manufacturerId].push(_locationId);
        allLocationIds.push(_locationId);

        emit LocationRegistered(
            _locationId,
            _manufacturerId,
            LocationType(_locationType),
            _locationDataHash,
            block.timestamp
        );
    }

    function getLocation(string memory _locationId)
        external
        view
        returns (
            string memory name,
            uint8 locationType,
            bytes32 dataHash,
            string memory manufacturerId,
            bool exists,
            uint256 registeredAt
        )
    {
        Location storage loc = locations[_locationId];
        return (
            loc.name,
            uint8(loc.locationType),
            loc.locationDataHash,
            loc.manufacturerId,
            loc.exists,
            loc.registeredAt
        );
    }

    function getManufacturerLocations(string memory _manufacturerId)
        external
        view
        returns (string[] memory)
    {
        return manufacturerLocations[_manufacturerId];
    }

    function locationExists(string memory _locationId) external view returns (bool) {
        return locations[_locationId].exists;
    }

    function verifyLocationDataHash(string memory _locationId, bytes32 _hash)
        external
        view
        returns (bool)
    {
        return locations[_locationId].locationDataHash == _hash;
    }
}
