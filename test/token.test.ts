import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  TokenFactory,
  TokenFactory__factory,
  VotesToken,
  VotesToken__factory,
  ClaimSubsidiary,
  ClaimSubsidiary__factory,
  ClaimFactory__factory,
  ClaimFactory,
  DAOAccessControl,
  DAOAccessControl__factory,
  ERC1967Proxy__factory,
  IModuleFactoryBase__factory,
  IModuleBase__factory,
  IClaimSubsidiary__factory,
} from "../typechain-types";
import chai from "chai";
import { ethers } from "hardhat";
import getInterfaceSelector from "./helpers/getInterfaceSelector";
import { ContractTransaction } from "ethers";

const expect = chai.expect;

describe("Token Factory", function () {
  let accessControl: DAOAccessControl;

  let tokenFactory: TokenFactory;
  let pToken: VotesToken;
  let cToken: VotesToken;

  let claimFactory: ClaimFactory;
  let claimSubsidiary: ClaimSubsidiary;
  let claimSubImpl: ClaimSubsidiary;
  let predictedClaimSub: string;

  let tx: ContractTransaction;

  // eslint-disable-next-line camelcase
  let deployer: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;
  let upgrader: SignerWithAddress;

  async function createClaim() {
    const abiCoder = new ethers.utils.AbiCoder();
    const claimData = [
      abiCoder.encode(["address"], [claimSubImpl.address]),
      abiCoder.encode(["bytes32"], [ethers.utils.formatBytes32String("hi")]),
    ];

    await cToken.approve(predictedClaimSub, ethers.utils.parseUnits("100", 18));

    const claimResult = await claimFactory.callStatic.create(
      deployer.address,
      claimData
    );

    tx = await claimFactory.create(deployer.address, claimData);
    // eslint-disable-next-line camelcase
    claimSubsidiary = ClaimSubsidiary__factory.connect(
      claimResult[0],
      deployer
    );
    await claimSubsidiary.initialize(
      deployer.address,
      accessControl.address,
      pToken.address,
      cToken.address,
      ethers.utils.parseUnits("100", 18)
    );
    expect(await cToken.balanceOf(claimSubsidiary.address)).to.eq(
      ethers.utils.parseUnits("100", 18)
    );
  }

  describe("Token / Factory", function () {
    beforeEach(async function () {
      [deployer, userA, userB, upgrader] = await ethers.getSigners();

      tokenFactory = await new TokenFactory__factory(deployer).deploy();
      claimFactory = await new ClaimFactory__factory(deployer).deploy();
      claimSubImpl = await new ClaimSubsidiary__factory(deployer).deploy();
      accessControl = await new DAOAccessControl__factory(deployer).deploy();

      await tokenFactory.initialize();
      await claimFactory.initialize();

      const { chainId } = await ethers.provider.getNetwork();
      const abiCoder = new ethers.utils.AbiCoder();
      predictedClaimSub = ethers.utils.getCreate2Address(
        claimFactory.address,
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
            ERC1967Proxy__factory.bytecode,
            abiCoder.encode(["address", "bytes"], [claimSubImpl.address, []]),
          ]
        )
      );

      const pData = [
        abiCoder.encode(["string"], ["ParentDecent"]),
        abiCoder.encode(["string"], ["pDCNT"]),
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

      const pResult = await tokenFactory.callStatic.create(
        deployer.address,
        pData
      );
      tx = await tokenFactory.create(deployer.address, pData);
      // eslint-disable-next-line camelcase
      pToken = VotesToken__factory.connect(pResult[0], deployer);

      const cData = [
        abiCoder.encode(["string"], ["ChildDecent"]),
        abiCoder.encode(["string"], ["cDCNT"]),
        abiCoder.encode(["address[]"], [[userB.address, deployer.address]]),
        abiCoder.encode(
          ["uint256[]"],
          [
            [
              ethers.utils.parseUnits("100", 18),
              ethers.utils.parseUnits("100", 18),
            ],
          ]
        ),
        abiCoder.encode(["bytes32"], [ethers.utils.formatBytes32String("hi")]),
      ];

      const cResult = await tokenFactory.callStatic.create(
        deployer.address,
        cData
      );
      tx = await tokenFactory.create(deployer.address, cData);
      // eslint-disable-next-line camelcase
      cToken = VotesToken__factory.connect(cResult[0], deployer);
      const upgraderRoleString = "UPGRADER_ROLE";
      const daoRoleString = "DAO_ROLE";
      await accessControl
        .connect(deployer)
        .initialize(
          deployer.address,
          [upgraderRoleString],
          [daoRoleString],
          [[upgrader.address]],
          [predictedClaimSub],
          ["upgradeTo(address)"],
          [[upgraderRoleString]]
        );
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
                "ParentDecent",
                "pDCNT",
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
      expect(pToken.address).to.eq(predictedToken);
    });

    it("Init is correct", async () => {
      expect(await pToken.name()).to.eq("ParentDecent");
      expect(await pToken.symbol()).to.eq("pDCNT");
      expect(await pToken.totalSupply()).to.eq(
        ethers.utils.parseUnits("250", 18)
      );
      expect(await pToken.balanceOf(deployer.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await pToken.balanceOf(userA.address)).to.eq(
        ethers.utils.parseUnits("150", 18)
      );

      expect(await cToken.name()).to.eq("ChildDecent");
      expect(await cToken.symbol()).to.eq("cDCNT");
      expect(await cToken.totalSupply()).to.eq(
        ethers.utils.parseUnits("200", 18)
      );
      expect(await cToken.balanceOf(userB.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await cToken.balanceOf(deployer.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
    });

    it("Can predict Claim Sub", async () => {
      await createClaim();
      // eslint-disable-next-line no-unused-expressions
      expect(claimSubsidiary.address).to.eq(predictedClaimSub);
    });

    it("Inits Snap", async () => {
      await createClaim();
      expect(await claimSubsidiary.accessControl()).to.eq(
        accessControl.address
      );
      expect(await claimSubsidiary.cToken()).to.eq(cToken.address);

      expect(await claimSubsidiary.pToken()).to.eq(pToken.address);
      expect(await claimSubsidiary.snapId()).to.eq(1);
      expect(await claimSubsidiary.pAllocation()).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
    });

    it("Claim Snap", async () => {
      await createClaim();
      const amount = await claimSubsidiary.calculateClaimAmount(
        deployer.address
      );
      // Claim on behalf
      await expect(
        claimSubsidiary.connect(userB).claimSnap(deployer.address)
      ).to.emit(claimSubsidiary, "SnapClaimed");
      expect(
        await amount
          .add(await await claimSubsidiary.calculateClaimAmount(userA.address))
          .add(
            await await claimSubsidiary.calculateClaimAmount(
              claimSubsidiary.address
            )
          )
      ).to.eq(ethers.utils.parseUnits("100", 18));
      expect(await cToken.balanceOf(deployer.address)).to.eq(amount);
      expect(await cToken.balanceOf(claimSubsidiary.address)).to.eq(
        ethers.utils.parseUnits("100", 18).sub(amount)
      );
    });

    it("Should revert double claim", async () => {
      await createClaim();
      await expect(claimSubsidiary.claimSnap(deployer.address)).to.emit(
        claimSubsidiary,
        "SnapClaimed"
      );
      expect(
        await claimSubsidiary.calculateClaimAmount(deployer.address)
      ).to.eq(0);
      await expect(
        claimSubsidiary.connect(userA).claimSnap(deployer.address)
      ).to.revertedWith("NoAllocation()");
      await expect(claimSubsidiary.claimSnap(deployer.address)).to.revertedWith(
        "NoAllocation()"
      );
    });

    it("Should revert without an allocation", async () => {
      await createClaim();
      await expect(claimSubsidiary.claimSnap(userB.address)).to.revertedWith(
        "NoAllocation()"
      );
    });

    it("Can be upgraded by an authorized user", async () => {
      await createClaim();
      const claimTwo = await new ClaimSubsidiary__factory(deployer).deploy();
      await expect(
        claimSubsidiary.connect(upgrader).upgradeTo(claimTwo.address)
      ).to.emit(claimSubsidiary, "Upgraded");
    });

    it("Cannot be upgraded by an unauthorized user", async () => {
      await createClaim();
      const claimTwo = await new ClaimSubsidiary__factory(deployer).deploy();
      await expect(
        claimSubsidiary.connect(deployer).upgradeTo(claimTwo.address)
      ).to.be.revertedWith("NotAuthorized()");
    });

    it("Supports the expected ERC165 interface", async () => {
      await createClaim();
      expect(
        await tokenFactory.supportsInterface(
          // eslint-disable-next-line camelcase
          getInterfaceSelector(IModuleFactoryBase__factory.createInterface())
        )
      ).to.eq(true);

      // Supports ERC-165 interface
      expect(
        await claimFactory.supportsInterface(
          // eslint-disable-next-line camelcase
          getInterfaceSelector(IModuleFactoryBase__factory.createInterface())
        )
      ).to.eq(true);

      expect(
        await claimSubsidiary.supportsInterface(
          // eslint-disable-next-line camelcase
          getInterfaceSelector(IModuleBase__factory.createInterface())
        )
      ).to.eq(true);

      expect(
        await claimSubsidiary.supportsInterface(
          // eslint-disable-next-line camelcase
          getInterfaceSelector(IClaimSubsidiary__factory.createInterface())
        )
      ).to.eq(true);
    });
  });
});
