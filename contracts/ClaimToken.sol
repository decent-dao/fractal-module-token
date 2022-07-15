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

    ///////////////////// Merkle ///////////////////////////////////////////
    function addMerkle(address token, bytes32 merkleRoot) public {
        require(
            merkles[token].merkleRoot == "",
            "This token has been initialized with a merkle root"
        );
        merkles[token].merkleRoot = merkleRoot;
    }

    function claimMerkle(
        address token,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) public {
        require(
            !merkles[token].isMerkleClaimed[account],
            "This allocation has been claimed"
        );
        merkles[token].isMerkleClaimed[account] == true;
        merkleVerify(token, account, amount, merkleProof);
        IERC20(token).safeTransfer(account, amount);
    }

    ////////////////////////// SnapShot //////////////////////////////////
    function addTokenDrop(
        address factory,
        address pToken,
        string memory name,
        string memory symbol,
        string memory salt,
        uint256 totalSupply,
        uint256 pAllocation
    ) public returns (address cToken) {
        bytes[] memory tokenBytes = new bytes[](5);
        tokenBytes[0] = abi.encode(name);
        tokenBytes[1] = abi.encode(symbol);
        tokenBytes[2] = abi.encode([address(this)]);
        tokenBytes[3] = abi.encode([totalSupply]);
        tokenBytes[4] = abi.encode(salt);

        cToken = TokenFactory(factory).create(msg.sender, tokenBytes)[0]; // create Token & create Hash
        cTokens[pToken][cToken].snapId = VotesToken(pToken).captureSnapShot();
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
