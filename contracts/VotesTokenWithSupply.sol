//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./VotesToken.sol";
// todo: shoudl be claimed and not just sent out

/**
 * @dev Initilizes Supply of votesToken
 */
 // We could simple deploy a token with a merkle root and allocation amount
 // We could maintain a list of tokens which can be claimed from the token Factory?
contract VotesTokenWithSupply is VotesToken {
    /**
    * @dev Mints tokens to hodlers w/ allocations 
    * @dev Returns the difference between total supply and allocations to treasury
    * @param name Token Name
    * @param symbol Token Symbol
    * @param hodlers Array of token receivers
    * @param allocations Allocations for each receiver
    */
    constructor(
        string memory name,
        string memory symbol,
        address[] memory hodlers,
        uint256[] memory allocations
    ) VotesToken(name, symbol) {
        uint256 tokenSum;
        for (uint256 i = 0; i < hodlers.length; i++) {
            _mint(hodlers[i], allocations[i]);
            tokenSum += allocations[i];
        }
    }
}