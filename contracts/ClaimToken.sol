//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TokenFactory.sol";

contract ClaimToken {
    using SafeERC20 for IERC20;
    
    struct ChildTokenInfo{
        uint snapId;
        mapping(address => bool) claimed;
    }
    mapping(address => mapping(address => ChildTokenInfo)) public cTokens; // pToken => cToken => snapId
    mapping(address => address) public findMyDaddy;

    // how should the token even be created?
    // where do the tokens live? DAO or in claim contract
    // how to update for vesting functionality
    function addTokenDrop(address factory, address pToken) public returns(address cToken) {
        bytes[] memory tokenBytes = new bytes[](5);

        tokenBytes[0] = abi.encode("name");
        tokenBytes[1] = abi.encode("symbol");
        tokenBytes[2] = abi.encode([address(this)]); // This should be dynamically generated so the claim contract works
        tokenBytes[3] = abi.encode([100]);
        tokenBytes[4] = abi.encode("salt");

        cToken = TokenFactory(factory).create(msg.sender, tokenBytes)[0]; // create Token & create Hash
        cTokens[pToken][cToken].snapId = VotesToken(pToken).captureSnapShot();
        findMyDaddy[cToken] = pToken;
    }

    function claim(address cToken, address claimer) public {
        address pToken = findMyDaddy[cToken];
        require(cTokens[pToken][cToken].claimed[claimer], "This allocation has been claimed");
        cTokens[findMyDaddy[cToken]][cToken].claimed[claimer] = true; // house keeping

        uint amount = calculateClaimAmount(pToken, cToken, claimer); // Get user balance
        IERC20(cToken).safeTransfer(claimer, amount); // transfer user balance
    }

    function calculateClaimAmount(address pToken, address cToken, address claimer) public view returns(uint userCTokenAllocation) {
        uint childTokenSupply;
        uint percentParentAllocation;
        uint pHoldersCTokenAllocation = percentParentAllocation * childTokenSupply; // total tokens avialable to pToken holders

        uint parentTokenSupply = VotesToken(pToken).totalSupplyAt(cTokens[pToken][cToken].snapId);
        uint userPTokenBalance = VotesToken(pToken).balanceOfAt(claimer, cTokens[pToken][cToken].snapId);
        uint userToTotalSupply = userPTokenBalance / parentTokenSupply; // user token balance / total supply

        userCTokenAllocation = pHoldersCTokenAllocation * userToTotalSupply; // usersCTokenAllocation
    }
}