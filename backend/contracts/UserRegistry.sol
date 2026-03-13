// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title UserRegistry
 * @dev Stores hashed credentials, roles, and wallet addresses on-chain.
 *      Each user is assigned an Ethereum wallet address at registration time.
 *      MedicineRegistry uses addressToUserId / addressToRole to enforce
 *      RBAC and manufacturer identity binding via msg.sender.
 */
contract UserRegistry {
    enum Role { NONE, HOSPITAL, MANUFACTURER }

    struct User {
        string userId;
        bytes32 passwordHash;   // keccak256 of bcrypt hash string
        string bcryptHash;      // full bcrypt hash for off-chain comparison
        Role role;
        address wallet;         // Ethereum address assigned to this user
        bool exists;
        uint256 createdAt;
    }

    // userId => User
    mapping(string => User) private users;

    // wallet address => userId  (reverse lookup used by MedicineRegistry)
    mapping(address => string) public addressToUserId;

    // wallet address => role  (used by MedicineRegistry modifiers)
    mapping(address => Role) public addressToRole;

    // List of all userIds for enumeration
    string[] private userIds;

    address public owner;

    event UserRegistered(string indexed userId, Role role, address wallet, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Register a new user with an assigned wallet address.
     * @param _userId     Unique user identifier
     * @param _bcryptHash Full bcrypt hash string (e.g. "$2b$12$...")
     * @param _role       1 = HOSPITAL, 2 = MANUFACTURER
     * @param _wallet     Ethereum address assigned to this user
     */
    function registerUser(
        string memory _userId,
        string memory _bcryptHash,
        uint8 _role,
        address _wallet
    ) external {
        require(!users[_userId].exists, "User already exists");
        require(_role == 1 || _role == 2, "Invalid role");
        require(_wallet != address(0), "Invalid wallet address");
        require(bytes(addressToUserId[_wallet]).length == 0, "Wallet already in use");

        Role role = Role(_role);

        users[_userId] = User({
            userId: _userId,
            passwordHash: keccak256(abi.encodePacked(_bcryptHash)),
            bcryptHash: _bcryptHash,
            role: role,
            wallet: _wallet,
            exists: true,
            createdAt: block.timestamp
        });

        addressToUserId[_wallet] = _userId;
        addressToRole[_wallet] = role;
        userIds.push(_userId);

        emit UserRegistered(_userId, role, _wallet, block.timestamp);
    }

    /**
     * @dev Get bcrypt hash for off-chain BCrypt.checkpw verification.
     */
    function getCredentials(string memory _userId)
        external
        view
        returns (string memory bcryptHash, uint8 role, bool exists)
    {
        User storage u = users[_userId];
        return (u.bcryptHash, uint8(u.role), u.exists);
    }

    /**
     * @dev Get the wallet address registered for a userId.
     */
    function getWallet(string memory _userId) external view returns (address) {
        require(users[_userId].exists, "User not found");
        return users[_userId].wallet;
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
