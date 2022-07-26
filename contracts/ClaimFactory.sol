//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@fractal-framework/core-contracts/contracts/ModuleFactoryBase.sol";
import "./interfaces/IClaimFactory.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./ClaimSubsidiary.sol";

/// @notice Token Factory used to deploy votes tokens
contract ClaimFactory is ModuleFactoryBase, IClaimFactory {
    function initialize() external initializer {
        __initFactoryBase();
    }

    /// @dev Creates an ERC-20 votes token
    /// @param creator The address creating the module
    /// @param data The array of bytes used to create the token
    /// @return address The address of the created token
    function create(address creator, bytes[] calldata data)
        external
        override(ModuleFactoryBase, IClaimFactory)
        returns (address[] memory)
    {
        address[] memory createdContracts = new address[](1);

        createdContracts[0] = _createClaimSubsidiary(
            abi.decode(data[0], (address)),
            abi.decode(data[1], (address)),
            creator,
            abi.decode(data[5], (bytes32)),
            abi.decode(data[2], (address)),
            abi.decode(data[3], (address)),
            abi.decode(data[4], (uint256))
        );

        return createdContracts;
    }

    function _createClaimSubsidiary(
        address accessControl,
        address subImpl,
        address creator,
        bytes32 salt,
        address pToken,
        address cToken,
        uint256 pAllocation
    ) internal returns (address createdSubsidiary) {
        createdSubsidiary = Create2.deploy(
            0,
            keccak256(
                abi.encodePacked(creator, msg.sender, block.chainid, salt)
            ),
            abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(subImpl, "")
            )
        );
        ClaimSubsidiary(payable(createdSubsidiary)).initialize(
            accessControl,
            pToken,
            cToken,
            pAllocation
        );
        emit SubsidiaryCreated(createdSubsidiary);
        return createdSubsidiary;
    }
}
