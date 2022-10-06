## DEPRECATED

This repository has been deprecated.

Please use this repository for the currently supported Fractal smart contracts:

https://github.com/decent-dao/fractal-contracts

# Token Factory

## Architecture

The Token Factory contract utilizes ERC20 Votes OpenZ contracts and the MVD for Factory Module Interface


### TokenFactory.sol

The TokenFactory Contract creates a VotesTokenSupply Contract that mints allocations to an array of holders and to the treasury address.

## Local Setup & Testing

Clone the repository:
```shell
git clone ...
```

Lookup the recommended Node version to use in the .nvmrc file and install and use the correct version:
```shell
nvm install 
nvm use
```

Install necessary dependencies:
```shell
npm install
```

Add `.env` values replacing the private key and provider values for desired networks
```shell
cp .env.example .env
```

Compile contracts to create typechain files:
```shell
npm run compile
```

Run the tests
```shell
npm run test
```
## Deploy Contract to <network>
```shell
npx hardhat deploy --network <network>
```

## Local Hardhat deployment

To deploy the base Fractal contracts open a terminal and run:
```shell
npx hardhat node
```
This will deploy the following contracts and log the addresses they were deployed to:
 - TokenFactory
