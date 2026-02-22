// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title UserRegistry
 * @dev Stores hashed credentials and roles on-chain.
 *      Passwords are bcrypt-hashed OFF-CHAIN before being stored here.
 *      The contract stores the hash string, never plaintext.
 */
contract UserRegistry {
    enum Role { NONE, HOSPITAL, MANUFACTURER }

    struct User {
        string userId;
        bytes32 passwordHash; // keccak256 of bcrypt hash string for on-chain comparison
        string bcryptHash;    // full bcrypt hash stored for BCrypt.checkpw off-chain
        Role role;
        bool exists;
        uint256 createdAt;
    }

    // userId => User
    mapping(string => User) private users;
    // Store list of userIds for enumeration
    string[] private userIds;

    address public owner;

    event UserRegistered(string indexed userId, Role role, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Register a new user. Called by hospital contract or deploy script.
     * @param _userId Unique user identifier
     * @param _bcryptHash Full bcrypt hash string (e.g., "$2b$12$...")
     * @param _role 1 = HOSPITAL, 2 = MANUFACTURER
     */
    function registerUser(
        string memory _userId,
        string memory _bcryptHash,
        uint8 _role
    ) external {
        require(!users[_userId].exists, "User already exists");
        require(_role == 1 || _role == 2, "Invalid role");

        users[_userId] = User({
            userId: _userId,
            passwordHash: keccak256(abi.encodePacked(_bcryptHash)),
            bcryptHash: _bcryptHash,
            role: Role(_role),
            exists: true,
            createdAt: block.timestamp
        });

        userIds.push(_userId);
        emit UserRegistered(_userId, Role(_role), block.timestamp);
    }

    /**
     * @dev Get bcrypt hash for off-chain BCrypt.checkpw verification.
     * @param _userId User to look up
     * @return bcryptHash stored hash string
     * @return role user role
     */
    function getCredentials(string memory _userId)
        external
        view
        returns (string memory bcryptHash, uint8 role, bool exists)
    {
        User storage u = users[_userId];
        return (u.bcryptHash, uint8(u.role), u.exists);
    }

    function userExists(string memory _userId) external view returns (bool) {
        return users[_userId].exists;
    }

    function getUserRole(string memory _userId) external view returns (uint8) {
        require(users[_userId].exists, "User not found");
        return uint8(users[_userId].role);
    }

    function getAllUsers() external view returns (string[] memory) {
        return userIds;
    }
}
