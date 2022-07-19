import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ITokenFactory__factory,
  TokenFactory,
  TokenFactory__factory,
  VotesToken,
  VotesToken__factory,
  ClaimToken,
  ClaimToken__factory,
} from "../typechain-types";
import chai from "chai";
import { ethers } from "hardhat";
import getInterfaceSelector from "./helpers/getInterfaceSelector";
import { BigNumber, BytesLike, ContractTransaction } from "ethers";
import { MerkleTree } from "merkletreejs";
import { constructMerkleTree, makeLeaves } from "./helpers/airDropHelpers";

const expect = chai.expect;

describe("Token Factory", function () {
  let tokenFactory: TokenFactory;
  let token: VotesToken;
  let claimToken: ClaimToken;
  let tx: ContractTransaction;

  // eslint-disable-next-line camelcase
  let deployer: SignerWithAddress;
  let dao: SignerWithAddress;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  let leaves: string[];
  let merkleTree: MerkleTree;
  let root: string;
  let proof: BytesLike[];
  let airdropClaimants: {
    addr: string;
    claim: BigNumber;
  }[];

  async function createWSnap() {
    airdropClaimants = [
      { addr: userB.address, claim: ethers.utils.parseUnits("100", 18) },
    ];

    // Prepare merkle tree of claimants
    leaves = makeLeaves(airdropClaimants);
    merkleTree = constructMerkleTree(leaves);

    // Create tree
    root = merkleTree.getHexRoot();

    const abiCoder = new ethers.utils.AbiCoder();
    const data = [
      abiCoder.encode(["string"], ["Token2"]),
      abiCoder.encode(["string"], ["TWO"]),
      abiCoder.encode(["uint256"], [ethers.utils.parseUnits("800", 18)]),
      abiCoder.encode(["address"], [claimToken.address]),
      abiCoder.encode(["bytes32"], [ethers.utils.formatBytes32String("hi")]),
      abiCoder.encode(["bytes32"], [root]),
      abiCoder.encode(["address"], [token.address]),
      abiCoder.encode(["uint256"], [ethers.utils.parseUnits("700", 18)]),
    ];

    const result = await tokenFactory.callStatic.createWSnap(
      deployer.address,
      data
    );
    tx = await tokenFactory.createWSnap(deployer.address, data);
    // eslint-disable-next-line camelcase
    return VotesToken__factory.connect(result[0], deployer);
  }

  describe("Token / Factory", function () {
    beforeEach(async function () {
      [deployer, dao, userA, userB] = await ethers.getSigners();

      tokenFactory = await new TokenFactory__factory(deployer).deploy();
      claimToken = await new ClaimToken__factory(deployer).deploy();

      airdropClaimants = [
        { addr: deployer.address, claim: ethers.utils.parseUnits("100", 18) },
        { addr: userA.address, claim: ethers.utils.parseUnits("150", 18) },
      ];

      // Prepare merkle tree of claimants
      leaves = makeLeaves(airdropClaimants);
      merkleTree = constructMerkleTree(leaves);

      // Create tree
      root = merkleTree.getHexRoot();

      const abiCoder = new ethers.utils.AbiCoder();
      const data = [
        abiCoder.encode(["string"], ["DECENT"]),
        abiCoder.encode(["string"], ["DCNT"]),
        abiCoder.encode(["uint256"], [ethers.utils.parseUnits("800", 18)]),
        abiCoder.encode(["address"], [claimToken.address]),
        abiCoder.encode(["bytes32"], [ethers.utils.formatBytes32String("hi")]),
        abiCoder.encode(["bytes32"], [root]),
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
              ["string", "string", "uint256", "address"],
              [
                "DECENT",
                "DCNT",
                ethers.utils.parseUnits("800", 18),
                claimToken.address,
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
        ethers.utils.parseUnits("800", 18)
      );
      expect(await token.balanceOf(claimToken.address)).to.eq(
        await token.totalSupply()
      );
      expect(await claimToken.merkles(token.address)).to.eq(root);
    });

    it("Can claim merkle amount", async () => {
      proof = merkleTree.getHexProof(leaves[0]);
      await expect(
        claimToken.claimMerkle(
          token.address,
          deployer.address,
          ethers.utils.parseUnits("100", 18),
          proof
        )
      ).to.emit(claimToken, "MerkleClaimed");
      expect(await token.balanceOf(deployer.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await token.balanceOf(claimToken.address)).to.eq(
        ethers.utils.parseUnits("700", 18)
      );
    });

    it("Can claim onBehalf", async () => {
      proof = merkleTree.getHexProof(leaves[1]);
      await expect(
        claimToken
          .connect(userB)
          .claimMerkle(
            token.address,
            userA.address,
            ethers.utils.parseUnits("150", 18),
            proof
          )
      ).to.emit(claimToken, "MerkleClaimed");
      expect(await token.balanceOf(userA.address)).to.eq(
        ethers.utils.parseUnits("150", 18)
      );
      expect(await token.balanceOf(userB.address)).to.eq(0);
      expect(await token.balanceOf(claimToken.address)).to.eq(
        ethers.utils.parseUnits("650", 18)
      );
    });

    it("Should Revert", async () => {
      proof = merkleTree.getHexProof(leaves[1]);
      // if a user tries to send someone elses claim to themselves
      await expect(
        claimToken
          .connect(userB)
          .claimMerkle(
            token.address,
            userB.address,
            ethers.utils.parseUnits("150", 18),
            proof
          )
      ).to.revertedWith("MerkleDistributor: Invalid proof.");
      // if a user tries to send more/less tokens to themselves
      await expect(
        claimToken
          .connect(userA)
          .claimMerkle(
            token.address,
            userA.address,
            ethers.utils.parseUnits("200", 18),
            proof
          )
      ).to.revertedWith("MerkleDistributor: Invalid proof.");
      await expect(
        claimToken
          .connect(userA)
          .claimMerkle(
            token.address,
            userA.address,
            ethers.utils.parseUnits("100", 18),
            proof
          )
      ).to.revertedWith("MerkleDistributor: Invalid proof.");
      // double claim
      await expect(
        claimToken
          .connect(userB)
          .claimMerkle(
            token.address,
            userA.address,
            ethers.utils.parseUnits("150", 18),
            proof
          )
      ).to.emit(claimToken, "MerkleClaimed");
      await expect(
        claimToken
          .connect(userA)
          .claimMerkle(
            token.address,
            userA.address,
            ethers.utils.parseUnits("150", 18),
            proof
          )
      ).to.revertedWith("This allocation has been claimed");
    });

    it("Creates WSnap - can claim merkle", async () => {
      const proof0 = merkleTree.getHexProof(leaves[0]);
      const proof1 = merkleTree.getHexProof(leaves[1]);
      await expect(
        claimToken.claimMerkle(
          token.address,
          deployer.address,
          ethers.utils.parseUnits("100", 18),
          proof0
        )
      ).to.emit(claimToken, "MerkleClaimed");
      await expect(
        claimToken.claimMerkle(
          token.address,
          userA.address,
          ethers.utils.parseUnits("150", 18),
          proof1
        )
      ).to.emit(claimToken, "MerkleClaimed");
      const token2 = await createWSnap();

      proof = merkleTree.getHexProof(leaves[0]);
      await expect(
        claimToken
          .connect(userB)
          .claimMerkle(
            token2.address,
            userB.address,
            ethers.utils.parseUnits("100", 18),
            proof
          )
      ).to.emit(claimToken, "MerkleClaimed");
      expect(await token2.balanceOf(userB.address)).to.eq(
        ethers.utils.parseUnits("100", 18)
      );
      expect(await token2.balanceOf(claimToken.address)).to.eq(
        ethers.utils.parseUnits("700", 18)
      );
    });

    it("Creates WSnap - Snap Initialized", async () => {
      const proof0 = merkleTree.getHexProof(leaves[0]);
      const proof1 = merkleTree.getHexProof(leaves[1]);
      await expect(
        claimToken.claimMerkle(
          token.address,
          deployer.address,
          ethers.utils.parseUnits("100", 18),
          proof0
        )
      ).to.emit(claimToken, "MerkleClaimed");
      await expect(
        claimToken.claimMerkle(
          token.address,
          userA.address,
          ethers.utils.parseUnits("150", 18),
          proof1
        )
      ).to.emit(claimToken, "MerkleClaimed");
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
      ).to.eq(ethers.utils.parseUnits("700", 18));
    });

    it("Creates WSnap - claim Snap", async () => {
      const proof0 = merkleTree.getHexProof(leaves[0]);
      const proof1 = merkleTree.getHexProof(leaves[1]);
      await expect(
        claimToken.claimMerkle(
          token.address,
          deployer.address,
          ethers.utils.parseUnits("100", 18),
          proof0
        )
      ).to.emit(claimToken, "MerkleClaimed");
      await expect(
        claimToken.claimMerkle(
          token.address,
          userA.address,
          ethers.utils.parseUnits("150", 18),
          proof1
        )
      ).to.emit(claimToken, "MerkleClaimed");
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
      ).to.eq(ethers.utils.parseUnits("700", 18));
      expect(await token2.balanceOf(deployer.address)).to.eq(amount);
      expect(await token2.balanceOf(claimToken.address)).to.eq(
        ethers.utils.parseUnits("800", 18).sub(amount)
      );
    });

    it("Should revert double claim", async () => {
      const proof0 = merkleTree.getHexProof(leaves[0]);
      const proof1 = merkleTree.getHexProof(leaves[1]);
      await expect(
        claimToken.claimMerkle(
          token.address,
          deployer.address,
          ethers.utils.parseUnits("100", 18),
          proof0
        )
      ).to.emit(claimToken, "MerkleClaimed");
      await expect(
        claimToken.claimMerkle(
          token.address,
          userA.address,
          ethers.utils.parseUnits("150", 18),
          proof1
        )
      ).to.emit(claimToken, "MerkleClaimed");
      const token2 = await createWSnap();
      await expect(
        claimToken.claimSnap(token2.address, deployer.address)
      ).to.emit(claimToken, "SnapClaimed");
      await expect(
        claimToken.claimSnap(token2.address, deployer.address)
      ).to.revertedWith("This allocation has been claimed");
    });

    it("Should revert without an allocation", async () => {
      const proof0 = merkleTree.getHexProof(leaves[0]);
      const proof1 = merkleTree.getHexProof(leaves[1]);
      await expect(
        claimToken.claimMerkle(
          token.address,
          deployer.address,
          ethers.utils.parseUnits("100", 18),
          proof0
        )
      ).to.emit(claimToken, "MerkleClaimed");
      await expect(
        claimToken.claimMerkle(
          token.address,
          userA.address,
          ethers.utils.parseUnits("150", 18),
          proof1
        )
      ).to.emit(claimToken, "MerkleClaimed");
      const token2 = await createWSnap();
      await expect(
        claimToken.claimSnap(token2.address, userB.address)
      ).to.revertedWith("The claimer does not have an allocation");
    });

    // todo: merkle tree
    // todo: snapshot

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
