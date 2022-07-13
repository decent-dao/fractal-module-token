pragma solidity ^0.8.0;
import "./VotesToken.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ClaimToken {
    using SafeERC20 for IERC20;
    
    mapping(address => uint) public tokenSnapId;
    mapping(address => mapping(address => bool)) public claimed;

    // how should the token even be created?
    // where do the tokens live? DAO or in claim contract
    // how to update for vesting functionality
    function addTokenDrop(address token) public {
        tokenSnapId[token] = VotesToken(token).captureSnapShot();
    }

    function claim(address token, address claimer) public {
        require(!claimed[token][claimer], "This allocation has been claimed");
        claimed[token][claimer] = true; // house keeping

        uint amount = calculateClaimAmount(token, claimer); // Get user balance
        IERC20(token).safeTransfer(claimer, amount); // transfer user balance
    }

    function calculateClaimAmount(address token, address claimer) public view returns(uint userCTokenAllocation) {
        uint childTokenSupply;
        uint percentParentAllocation;
        uint pHoldersCTokenAllocation = percentParentAllocation * childTokenSupply; // total tokens avialable to pToken holders

        uint parentTokenSupply = VotesToken(token).totalSupplyAt(tokenSnapId[token]);
        uint userPTokenBalance = VotesToken(token).balanceOfAt(claimer, tokenSnapId[token]);
        uint userToTotalSupply = userPTokenBalance / parentTokenSupply; // user token balance / total supply

        userCTokenAllocation = pHoldersCTokenAllocation * userToTotalSupply; // usersCTokenAllocation
    }
}