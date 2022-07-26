import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployNonUpgradeable } from "../helpers/deployNonUpgradeable";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  await deployNonUpgradeable(hre, "ClaimFactory", []);
  const claimFactory = await hre.ethers.getContract("ClaimFactory");
  await claimFactory.initialize();
};
export default func;
