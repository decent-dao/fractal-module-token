//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IClaimSubsidiary {
    struct ChildTokenInfo {
        uint256 snapId;
        uint256 pAllocation;
        mapping(address => bool) isSnapClaimed;
    }
    event SnapAdded(address pToken, address cToken, uint256 pAllocation);
    event SnapClaimed(
        address indexed pToken,
        address indexed cToken,
        address indexed claimer,
        uint256 amount
    );

        ////////////////////////// SnapShot //////////////////////////////////
    /// @notice This function creates a cToken and assigns a snapshot Id for pToken holder claims
    /// @param tokenFactory The token factory which the developer wants to use to deploy token instances
    /// @param createTokenData Name, symbol, holders, allocations for the new cToken
    /// @param pToken Address of the parent token used for snapshot reference
    /// @param pAllocation Total tokens allocated for pToken holders
    /// @return cToken Address of the token created
    function createSubsidiary(
        address tokenFactory,
        bytes[] calldata createTokenData,
        address pToken,
        uint256 pAllocation
    ) external returns (address cToken);

    /// @notice This function allows pToken holders to claim cTokens
    /// @param cToken Address of cToken
    /// @param claimer Address which is being claimed for
    function claimSnap(address cToken, address claimer) external;

    //////////////////// View Functions //////////////////////////
    /// @notice Calculate a users cToken allocation
    /// @param pToken Address of pToken
    /// @param cToken Address of cToken
    /// @param claimer Address which is being claimed for
    /// @return cTokenAllocation Users cToken allocation  
    function calculateClaimAmount(
        address pToken,
        address cToken,
        address claimer
    ) external view returns (uint256 cTokenAllocation);
}
