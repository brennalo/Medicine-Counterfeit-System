// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract UserAuth {
    enum UserRole { None, Hospital, Manufacturer }
    
    struct User {
        string userId;
        string name;
        string businessId;
        bytes32 passwordHash;
        UserRole role;
        bool isActive;
        uint256 createdAt;
    }
    
    // Mapping from userId to User
    mapping(string => User) private users;
    
    // Mapping to check if userId exists
    mapping(string => bool) public userExists;
    
    // Events
    event UserRegistered(string indexed userId, UserRole role, uint256 timestamp);
    event UserLoggedIn(string indexed userId, uint256 timestamp);
    
    // Owner (admin) address - should be set to hospital initially
    address public owner;
    
    // Modifier to restrict functions to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // Register initial hospital (can only be called by owner/contract deployer)
    function registerHospital(
        string memory _userId,
        string memory _name,
        string memory _businessId,
        string memory _password
    ) public onlyOwner {
        require(!userExists[_userId], "User ID already exists");
        require(bytes(_userId).length > 0, "User ID cannot be empty");
        require(bytes(_password).length > 0, "Password cannot be empty");
        
        bytes32 passwordHash = keccak256(abi.encodePacked(_password));
        
        users[_userId] = User({
            userId: _userId,
            name: _name,
            businessId: _businessId,
            passwordHash: passwordHash,
            role: UserRole.Hospital,
            isActive: true,
            createdAt: block.timestamp
        });
        
        userExists[_userId] = true;
        
        emit UserRegistered(_userId, UserRole.Hospital, block.timestamp);
    }
    
    // Hospital registers a manufacturer
    function registerManufacturer(
        string memory _hospitalId,
        string memory _hospitalPassword,
        string memory _manufacturerId,
        string memory _manufacturerName,
        string memory _manufacturerBusinessId,
        string memory _manufacturerPassword
    ) public {
        // Verify hospital credentials
        require(userExists[_hospitalId], "Hospital not found");
        require(users[_hospitalId].role == UserRole.Hospital, "Only hospitals can register manufacturers");
        require(users[_hospitalId].isActive, "Hospital account is inactive");
        
        bytes32 hospitalPasswordHash = keccak256(abi.encodePacked(_hospitalPassword));
        require(users[_hospitalId].passwordHash == hospitalPasswordHash, "Invalid hospital password");
        
        // Check manufacturer doesn't exist
        require(!userExists[_manufacturerId], "Manufacturer ID already exists");
        require(bytes(_manufacturerId).length > 0, "Manufacturer ID cannot be empty");
        require(bytes(_manufacturerPassword).length > 0, "Password cannot be empty");
        
        bytes32 manufacturerPasswordHash = keccak256(abi.encodePacked(_manufacturerPassword));
        
        users[_manufacturerId] = User({
            userId: _manufacturerId,
            name: _manufacturerName,
            businessId: _manufacturerBusinessId,
            passwordHash: manufacturerPasswordHash,
            role: UserRole.Manufacturer,
            isActive: true,
            createdAt: block.timestamp
        });
        
        userExists[_manufacturerId] = true;
        
        emit UserRegistered(_manufacturerId, UserRole.Manufacturer, block.timestamp);
    }
    
    // Login function - verifies credentials and returns user info
    function login(string memory _userId, string memory _password) 
        public 
        returns (bool success, string memory name, string memory businessId, UserRole role) 
    {
        require(userExists[_userId], "User not found");
        require(users[_userId].isActive, "User account is inactive");
        
        bytes32 passwordHash = keccak256(abi.encodePacked(_password));
        require(users[_userId].passwordHash == passwordHash, "Invalid password");
        
        User memory user = users[_userId];
        
        emit UserLoggedIn(_userId, block.timestamp);
        
        return (true, user.name, user.businessId, user.role);
    }
    
    // Get user info (without password)
    function getUserInfo(string memory _userId) 
        public 
        view 
        returns (string memory name, string memory businessId, UserRole role, bool isActive, uint256 createdAt) 
    {
        require(userExists[_userId], "User not found");
        
        User memory user = users[_userId];
        return (user.name, user.businessId, user.role, user.isActive, user.createdAt);
    }
    
    // Verify if user credentials are correct (read-only, no event emission)
    function verifyCredentials(string memory _userId, string memory _password) 
        public 
        view 
        returns (bool isValid, UserRole role) 
    {
        if (!userExists[_userId]) {
            return (false, UserRole.None);
        }
        
        if (!users[_userId].isActive) {
            return (false, UserRole.None);
        }
        
        bytes32 passwordHash = keccak256(abi.encodePacked(_password));
        if (users[_userId].passwordHash == passwordHash) {
            return (true, users[_userId].role);
        }
        
        return (false, UserRole.None);
    }
}
