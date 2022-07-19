//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./TokenFactory.sol";

// todo: add vesting ability
//todo: remove liquidity if not claimed
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

    event MerkleAdded(address token, bytes32 merkleRoot);
    event MerkleClaimed(
        address indexed token,
        address indexed claimer,
        uint256 amount
    );
    event SnapAdded(address pToken, address cToken, uint256 pAllocation);
    event SnapClaimed(
        address indexed pToken,
        address indexed cToken,
        address indexed claimer,
        uint256 amount
    );

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
        emit MerkleAdded(token, merkleRoot);
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
        merkles[token].isMerkleClaimed[claimer] = true;
        merkleVerify(token, claimer, amount, merkleProof);
        IERC20(token).safeTransfer(claimer, amount);
        emit MerkleClaimed(token, claimer, amount);
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
