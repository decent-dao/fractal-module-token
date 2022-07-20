//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./TokenFactory.sol";

contract ClaimSubsidiary {
    using SafeERC20 for IERC20;

    struct ChildTokenInfo {
        uint256 snapId;
        uint256 pAllocation;
        mapping(address => bool) isSnapClaimed;
    }
    mapping(address => mapping(address => ChildTokenInfo)) public cTokens; // pToken => cToken => snapId
    mapping(address => address) public findMyDaddy;

    event SnapAdded(address pToken, address cToken, uint256 pAllocation);
    event SnapClaimed(
        address indexed pToken,
        address indexed cToken,
        address indexed claimer,
        uint256 amount
    );

    ////////////////////////// SnapShot //////////////////////////////////
    function addSnap(
        address pToken,
        address cToken,
        uint256 pAllocation
    ) external returns (uint256 snapId) {
        require(
            cTokens[pToken][cToken].snapId == 0,
            "This token has already been initilized with a snapId"
        );
        snapId = VotesToken(pToken).captureSnapShot();
        cTokens[pToken][cToken].snapId = snapId;
        cTokens[pToken][cToken].pAllocation = pAllocation;
        findMyDaddy[cToken] = pToken;
        emit SnapAdded(pToken, cToken, pAllocation);
    }

    function claimSnap(address cToken, address claimer) public {
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
