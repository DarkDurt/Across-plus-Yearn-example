import axios from 'axios';
import { ethers } from 'ethers';

const originChainId = 10 // OPTIMISM chain id
const destinationChainId = 1 // ETH  chain id

// for OPTIMISM chain (origin chain)
const spokePoolAddress = "0x6f26Bf09B1C792e3228e5467807a900A503c0281"; // OPTIMISM SpokePool

const spokePoolABI = [
  "function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes calldata message) external",
];

const vaultAsset = "0xdAC17F958D2ee523a2206206994597C13D831ec7" // eth chain (Destination chain)
const yearnVaultAddress = "0x310B7Ea7475A0B449Cfd73bE81522F1B88eFAFaa" // eth chain (Destination chain)
const assetOnOptimism = "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"

const handler = "0x924a9f036260DdD5808007E1AA95f08eD08aA569" // ETH (destination chain id across multicall Handler address)

const erc20ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)"
];

export async function checkAllowance(signer, tokenAddress, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);
  const allowance = await tokenContract.allowance(signer.getAddress(), spokePoolAddress);
  return allowance.gte(amount);
}

export async function approveToken(signer, tokenAddress, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);
  const tx = await tokenContract.approve(spokePoolAddress, amount);
  await tx.wait();
  return tx.hash;
}