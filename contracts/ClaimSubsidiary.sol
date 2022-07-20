//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./interfaces/IClaimSubsidiary.sol";
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./TokenFactory.sol";

contract ClaimSubsidiary is IClaimSubsidiary {
    using SafeERC20 for IERC20;

    mapping(address => mapping(address => ChildTokenInfo)) public cTokens; // pToken => cToken => snapId
    mapping(address => address) public findMyDaddy;

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
    ) external returns (address cToken) {
        cToken = TokenFactory(tokenFactory).create(msg.sender, createTokenData)[
                0
            ];
        require(
            cTokens[pToken][cToken].snapId == 0,
            "This token has already been initilized with a snapId"
        );
        uint256 snapId = VotesToken(pToken).captureSnapShot();
        cTokens[pToken][cToken].snapId = snapId;
        cTokens[pToken][cToken].pAllocation = pAllocation;
        findMyDaddy[cToken] = pToken;
        emit SnapAdded(pToken, cToken, pAllocation);
    }

    /// @notice This function allows pToken holders to claim cTokens
    /// @param cToken Address of cToken
    /// @param claimer Address which is being claimed for
    function claimSnap(address cToken, address claimer) external {
        address pToken = findMyDaddy[cToken];
        uint256 amount = calculateClaimAmount(pToken, cToken, claimer); // Get user balance
        require(amount > 0, "The claimer does not have an allocation");
        require(
            !cTokens[pToken][cToken].isSnapClaimed[claimer],
            "This allocation has been claimed"
        );
        cTokens[pToken][cToken].isSnapClaimed[claimer] = true;

        IERC20(cToken).safeTransfer(claimer, amount); // transfer user balance
        emit SnapClaimed(pToken, cToken, claimer, amount);
    }

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
    ) public view returns (uint256 cTokenAllocation) {
        cTokenAllocation =
            (VotesToken(pToken).balanceOfAt(
                claimer,
                cTokens[pToken][cToken].snapId
            ) * cTokens[pToken][cToken].pAllocation) /
            VotesToken(pToken).totalSupplyAt(cTokens[pToken][cToken].snapId);
    }
}
