import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const claimFactory = await hre.ethers.getContract("ClaimFactory");
  const tokenFactory = await hre.ethers.getContract("TokenFactory");
  await claimFactory.initialize();
  await tokenFactory.initialize();
  console.log("init complete");
};
export default func;
