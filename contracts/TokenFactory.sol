//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./interfaces/ITokenFactory.sol";
import "./VotesToken.sol";
import "./ClaimSubsidiary.sol";
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
        address[] memory hodlers = abi.decode(data[2], (address[]));
        uint256[] memory allocations = abi.decode(data[3], (uint256[]));
        bytes32 salt = abi.decode(data[4], (bytes32));

        createdContracts[0] = _createToken(
            creator,
            salt,
            name,
            symbol,
            hodlers,
            allocations
        );

        return createdContracts;
    }

    function _createToken(
        address creator,
        bytes32 salt,
        string memory name,
        string memory symbol,
        address[] memory _hodlers,
        uint256[] memory _allocations
    ) internal returns (address createdToken) {
        createdToken = Create2.deploy(
            0,
            keccak256(
                abi.encodePacked(creator, msg.sender, block.chainid, salt)
            ),
            abi.encodePacked(
                type(VotesToken).creationCode,
                abi.encode(name, symbol, _hodlers, _allocations)
            )
        );
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
