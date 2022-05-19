import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  VotesTokenWithSupply,
  VotesTokenWithSupply__factory,
  IModuleFactory__factory,
  TokenFactory,
  TokenFactory__factory,
} from "../typechain-types";
import chai from "chai";
import { ethers } from "hardhat";
import getInterfaceSelector from "./helpers/getInterfaceSelector";

const expect = chai.expect;

describe("Token Factory", function () {
  let tokenFactory: TokenFactory;
  let token: VotesTokenWithSupply;

  // eslint-disable-next-line camelcase
  let deployer: SignerWithAddress;
  let dao: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  describe("Token / Factory", function () {
    beforeEach(async function () {
      [deployer, dao, userA, userB] = await ethers.getSigners();

      tokenFactory = await new TokenFactory__factory(deployer).deploy();

      const abiCoder = new ethers.utils.AbiCoder();
      const data = [
        abiCoder.encode(["address"], [dao.address]),
        abiCoder.encode(["string"], ["DECENT"]),
        abiCoder.encode(["string"], ["DCNT"]),
        abiCoder.encode(["address[]"], [[userA.address, userB.address]]),
        abiCoder.encode(
          ["uint256[]"],
          [
            [
              ethers.utils.parseUnits("100", 18),
              ethers.utils.parseUnits("100", 18),
            ],
          ]
        ),
        abiCoder.encode(["uint256"], [ethers.utils.parseUnits("1000", 18)]),
      ];

      const result = await tokenFactory.callStatic.create(data);
      await tokenFactory.create(data);
      // eslint-disable-next-line camelcase
      token = VotesTokenWithSupply__factory.connect(result[0], deployer);
    });

    it("Token/Factory Deployed", async () => {
      // eslint-disable-next-line no-unused-expressions
      expect(tokenFactory.address).to.be.properAddress;
      // eslint-disable-next-line no-unused-expressions
      expect(token.address).to.be.properAddress;
    });

    it("Init is correct", async () => {
      expect(await token.name()).to.eq("DECENT");
      expect(await token.symbol()).to.eq("DCNT");
    });

    it("Balances are correct", async () => {
      expect(await token.balanceOf(userA.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await token.balanceOf(userB.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await token.balanceOf(dao.address)).to.eq(
        ethers.utils.parseUnits("800", 18)
      );
    });

    it("Token Factory does not deploy with incorrect data", async () => {
      const abiCoder = new ethers.utils.AbiCoder();
      const data = [
        abiCoder.encode(["address"], [dao.address]),
        abiCoder.encode(["address"], [userA.address]),
        abiCoder.encode(["string"], ["DCNT"]),
        abiCoder.encode(["address[]"], [[userA.address, userB.address]]),
        abiCoder.encode(
          ["uint256[]"],
          [
            [
              ethers.utils.parseUnits("100", 18),
              ethers.utils.parseUnits("100", 18),
            ],
          ]
        ),
        abiCoder.encode(["uint256"], [ethers.utils.parseUnits("1000", 18)]),
      ];

      // const result = await tokenFactory.callStatic.create(data);
      await expect(tokenFactory.callStatic.create(data)).to.be.reverted;
    });

    it("Supports the expected ERC165 interface", async () => {
      expect(
        await tokenFactory.supportsInterface(
          // eslint-disable-next-line camelcase
          getInterfaceSelector(IModuleFactory__factory.createInterface())
        )
      ).to.eq(true);

      // Supports ERC-165 interface
      expect(await tokenFactory.supportsInterface("0x01ffc9a7")).to.eq(true);
    });
  });
});