//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/ITokenFactory.sol";
import "./VotesToken.sol";
import "./ClaimToken.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

/// @notice Token Factory used to deploy votes tokens
contract TokenFactory is ITokenFactory, ERC165 {
    /// @dev Creates an ERC-20 votes token
    /// @param creator The address creating the module
    /// @param data The array of bytes used to create the token
    /// @return address The address of the created token
    function create(address creator, bytes[] calldata data)
        external
        override
        returns (address[] memory)
    {
        address[] memory createdContracts = new address[](1);

        string memory name = abi.decode(data[0], (string));
        string memory symbol = abi.decode(data[1], (string));
        uint256 totalSupply = abi.decode(data[2], (uint256));
        address claimContract = abi.decode(data[3], (address));
        bytes32 salt = abi.decode(data[4], (bytes32));
        bytes32 merkleRoot = abi.decode(data[5], (bytes32));

        createdContracts[0] = _createToken(
            creator,
            claimContract,
            salt,
            merkleRoot,
            name,
            symbol,
            totalSupply
        );

        return createdContracts;
    }

    function createWSnap(address creator, bytes[] calldata data)
        external
        returns (address[] memory)
    {
        address[] memory createdContracts = new address[](1);

        string memory name = abi.decode(data[0], (string));
        string memory symbol = abi.decode(data[1], (string));
        uint256 totalSupply = abi.decode(data[2], (uint256));
        address claimContract = abi.decode(data[3], (address));
        bytes32 salt = abi.decode(data[4], (bytes32));
        bytes32 merkleRoot = abi.decode(data[5], (bytes32));

        // create Snapshot
        address pToken = abi.decode(data[6], (address));
        uint256 pAllocation = abi.decode(data[7], (uint256));

        createdContracts[0] = _createToken(
            creator,
            claimContract,
            salt,
            merkleRoot,
            name,
            symbol,
            totalSupply
        );
        ClaimToken(claimContract).addSnap(
            pToken,
            createdContracts[0],
            pAllocation
        );

        return createdContracts;
    }

    function _createToken(
        address creator,
        address claimContract,
        bytes32 salt,
        bytes32 merkleRoot,
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) internal returns (address createdToken) {
        createdToken = Create2.deploy(
            0,
            keccak256(
                abi.encodePacked(creator, msg.sender, block.chainid, salt)
            ),
            abi.encodePacked(
                type(VotesToken).creationCode,
                abi.encode(name, symbol, totalSupply, claimContract)
            )
        );
        ClaimToken(claimContract).addMerkle(createdToken, merkleRoot);
        emit TokenCreated(createdToken);
        return createdToken;
    }

    /// @notice Returns whether a given interface ID is supported
    /// @param interfaceId An interface ID bytes4 as defined by ERC-165
    /// @return bool Indicates whether the interface is supported
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165)
        returns (bool)
    {
        return
            interfaceId == type(ITokenFactory).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
