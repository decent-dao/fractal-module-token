import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ITokenFactory__factory,
  TokenFactory,
  TokenFactory__factory,
  VotesToken,
  VotesToken__factory,
  ClaimSubsidiary,
  ClaimSubsidiary__factory,
} from "../typechain-types";
import chai from "chai";
import { ethers } from "hardhat";
import getInterfaceSelector from "./helpers/getInterfaceSelector";
import { ContractTransaction } from "ethers";

const expect = chai.expect;

describe("Token Factory", function () {
  let tokenFactory: TokenFactory;
  let token: VotesToken;
  let claimToken: ClaimSubsidiary;
  let tx: ContractTransaction;

  // eslint-disable-next-line camelcase
  let deployer: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  async function createWSnap() {
    const abiCoder = new ethers.utils.AbiCoder();
    const data = [
      abiCoder.encode(["string"], ["DECENT"]),
      abiCoder.encode(["string"], ["DCNT"]),
      abiCoder.encode(["address[]"], [[claimToken.address]]),
      abiCoder.encode(["uint256[]"], [[ethers.utils.parseUnits("800", 18)]]),
      abiCoder.encode(["bytes32"], [ethers.utils.formatBytes32String("hi")]),
    ];
    const result = await claimToken.callStatic.createSubsidiary(
      tokenFactory.address,
      data,
      token.address,
      ethers.utils.parseUnits("800", 18)
    );

    tx = await claimToken.createSubsidiary(
      tokenFactory.address,
      data,
      token.address,
      ethers.utils.parseUnits("800", 18)
    );
    // eslint-disable-next-line camelcase
    return VotesToken__factory.connect(result, deployer);
  }

  describe("Token / Factory", function () {
    beforeEach(async function () {
      [deployer, userA, userB] = await ethers.getSigners();

      tokenFactory = await new TokenFactory__factory(deployer).deploy();
      claimToken = await new ClaimSubsidiary__factory(deployer).deploy();

      const abiCoder = new ethers.utils.AbiCoder();
      const data = [
        abiCoder.encode(["string"], ["DECENT"]),
        abiCoder.encode(["string"], ["DCNT"]),
        abiCoder.encode(["address[]"], [[deployer.address, userA.address]]),
        abiCoder.encode(
          ["uint256[]"],
          [
            [
              ethers.utils.parseUnits("100", 18),
              ethers.utils.parseUnits("150", 18),
            ],
          ]
        ),
        abiCoder.encode(["bytes32"], [ethers.utils.formatBytes32String("hi")]),
      ];

      const result = await tokenFactory.callStatic.create(
        deployer.address,
        data
      );
      tx = await tokenFactory.create(deployer.address, data);
      // eslint-disable-next-line camelcase
      token = VotesToken__factory.connect(result[0], deployer);
    });

    it("Token/Factory Deployed", async () => {
      // eslint-disable-next-line no-unused-expressions
      expect(tokenFactory.address).to.be.properAddress;
      // eslint-disable-next-line no-unused-expressions
      expect(token.address).to.be.properAddress;
      await expect(tx)
        .to.emit(tokenFactory, "TokenCreated")
        .withArgs(token.address);
    });

    it("Can predict Token Address", async () => {
      const { chainId } = await ethers.provider.getNetwork();
      const abiCoder = new ethers.utils.AbiCoder();
      const predictedToken = ethers.utils.getCreate2Address(
        tokenFactory.address,
        ethers.utils.solidityKeccak256(
          ["address", "address", "uint256", "bytes32"],
          [
            deployer.address,
            deployer.address,
            chainId,
            ethers.utils.formatBytes32String("hi"),
          ]
        ),
        ethers.utils.solidityKeccak256(
          ["bytes", "bytes"],
          [
            // eslint-disable-next-line camelcase
            VotesToken__factory.bytecode,
            abiCoder.encode(
              ["string", "string", "address[]", "uint256[]"],
              [
                "DECENT",
                "DCNT",
                [deployer.address, userA.address],
                [
                  ethers.utils.parseUnits("100", 18),
                  ethers.utils.parseUnits("150", 18),
                ],
              ]
            ),
          ]
        )
      );

      // eslint-disable-next-line no-unused-expressions
      expect(token.address).to.eq(predictedToken);
    });

    it("Init is correct", async () => {
      expect(await token.name()).to.eq("DECENT");
      expect(await token.symbol()).to.eq("DCNT");
      expect(await token.totalSupply()).to.eq(
        ethers.utils.parseUnits("250", 18)
      );
      expect(await token.balanceOf(deployer.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await token.balanceOf(userA.address)).to.eq(
        ethers.utils.parseUnits("150", 18)
      );
    });

    it("Creates WSnap - Snap Initialized", async () => {
      const token2 = await createWSnap();
      expect(
        await (
          await claimToken.cTokens(token.address, token2.address)
        ).snapId
      ).to.eq(1);
      expect(
        await (
          await claimToken.cTokens(token.address, token2.address)
        ).pAllocation
      ).to.eq(ethers.utils.parseUnits("800", 18));
    });

    it("Creates WSnap - claim Snap", async () => {
      const token2 = await createWSnap();
      const amount = await claimToken.calculateClaimAmount(
        token.address,
        token2.address,
        deployer.address
      );
      // Claim on behalf
      await expect(
        claimToken.connect(userB).claimSnap(token2.address, deployer.address)
      ).to.emit(claimToken, "SnapClaimed");
      expect(
        await amount
          .add(
            await await claimToken.calculateClaimAmount(
              token.address,
              token2.address,
              userA.address
            )
          )
          .add(
            await await claimToken.calculateClaimAmount(
              token.address,
              token2.address,
              claimToken.address
            )
          )
      ).to.eq(ethers.utils.parseUnits("800", 18));
      expect(await token2.balanceOf(deployer.address)).to.eq(amount);
      expect(await token2.balanceOf(claimToken.address)).to.eq(
        ethers.utils.parseUnits("800", 18).sub(amount)
      );
    });

    it("Should revert double claim", async () => {
      const token2 = await createWSnap();
      await expect(
        claimToken.claimSnap(token2.address, deployer.address)
      ).to.emit(claimToken, "SnapClaimed");
      await expect(
        claimToken.claimSnap(token2.address, deployer.address)
      ).to.revertedWith("This allocation has been claimed");
    });

    it("Should revert without an allocation", async () => {
      const token2 = await createWSnap();
      await expect(
        claimToken.claimSnap(token2.address, userB.address)
      ).to.revertedWith("The claimer does not have an allocation");
    });

    it("Supports the expected ERC165 interface", async () => {
      expect(
        await tokenFactory.supportsInterface(
          // eslint-disable-next-line camelcase
          getInterfaceSelector(ITokenFactory__factory.createInterface())
        )
      ).to.eq(true);

      // Supports ERC-165 interface
      expect(await tokenFactory.supportsInterface("0x01ffc9a7")).to.eq(true);
    });
  });
});
