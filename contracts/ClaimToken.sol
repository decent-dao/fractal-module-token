//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./TokenFactory.sol";

// todo: add vesting ability
//todo: add ability to add additional holders
contract ClaimToken {
    using SafeERC20 for IERC20;

    struct ChildTokenInfo {
        uint256 snapId;
        uint256 pAllocation;
        mapping(address => bool) isSnapClaimed;
    }
    struct MerkleInfo {
        bytes32 merkleRoot;
        mapping(address => bool) isMerkleClaimed;
    }
    mapping(address => mapping(address => ChildTokenInfo)) public cTokens; // pToken => cToken => snapId
    mapping(address => address) public findMyDaddy;
    mapping(address => MerkleInfo) public merkles;

    ///////////////// Merkle And Swap //////////////////////////

    function batchClaimMerkleAndSnap(
        address[] calldata cToken,
        address[] calldata claimer,
        uint256[] calldata amount,
        bytes32[][] calldata merkleProof
    ) external {
        for (uint256 i; i < cToken.length; i++) {
            claimMerkle(cToken[i], claimer[i], amount[i], merkleProof[i]);
            claimSnap(cToken[i], claimer[i]);
        }
    }

    ///////////////////// Merkle ///////////////////////////////////////////
    function addMerkle(address token, bytes32 merkleRoot) external {
        require(
            merkles[token].merkleRoot == "",
            "This token has been initialized with a merkle root"
        );
        merkles[token].merkleRoot = merkleRoot;
    }

    function claimMerkle(
        address token,
        address claimer,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) public {
        require(
            !merkles[token].isMerkleClaimed[claimer],
            "This allocation has been claimed"
        );
        merkles[token].isMerkleClaimed[claimer] == true;
        merkleVerify(token, claimer, amount, merkleProof);
        IERC20(token).safeTransfer(claimer, amount);
    }

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
    }

    function claimSnap(address cToken, address claimer) public {
        address pToken = findMyDaddy[cToken];
        require(
            cTokens[pToken][cToken].isSnapClaimed[claimer],
            "This allocation has been claimed"
        );
        cTokens[pToken][cToken].isSnapClaimed[claimer] = true;

        uint256 amount = calculateClaimAmount(pToken, cToken, claimer); // Get user balance
        IERC20(cToken).safeTransfer(claimer, amount); // transfer user balance
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
            ) * IERC20(cToken).totalSupply()) /
            VotesToken(pToken).totalSupplyAt(cTokens[pToken][cToken].snapId);
    }

    function merkleVerify(
        address token,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) public view returns (bool success) {
        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(account, amount));
        require(
            MerkleProof.verify(merkleProof, merkles[token].merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );
        success = true;
    }
}
