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

const handler = "0x924a9f036260DdD5808007E1AA95f08eD08aA569" // ETH (destination chain id across multichain Handler address)

const erc20ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)"
];

// step 1: Request a Quote
export async function fetchBridgeQuote(tokenAddress, amount, originChainId, destinationChainId, message) {
  try {
    const quoteResponse = await axios.get("https://app.across.to/api/suggested-fees", {
      params: {
        token: tokenAddress,
        originChainId,
        destinationChainId,
        amount: amount.toString(), // amount in wei
        message: message,
        recipient:handler
      },
    });

    return quoteResponse.data;
  } catch (error) {
    console.error("Error fetching bridge quote:", error);
    throw error;
  }
}

// step 2: Initiating a Deposit (User Intent)
export async function initiateBridgeDeposit(signer, tokenAddress, amount) {
  
  const userAddress = await signer.getAddress();
  const message = await generateMessageForMulticallHandler(userAddress, amount)

  const quoteData = await fetchBridgeQuote(tokenAddress, amount, originChainId, destinationChainId, message) 
  const spokePool = new ethers.Contract(spokePoolAddress, spokePoolABI, signer);

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  // The outputAmount is set as the inputAmount - relay fees.
  // totalRelayFee.total is returned by the Across API suggested-fees
  // endpoint.
  const outputAmount = amount.sub(ethers.BigNumber.from(quoteData.totalRelayFee.total));
  const fillDeadline = Math.round(Date.now() / 1000) + 18000; // 5 hours from now

  // update the message by using outputAmount (optional: depends on your logic)
  const updatedMessage = await generateMessageForMulticallHandler(userAddress, outputAmount)
  console.log("updatedMessage", updatedMessage)

  try {
    // Initiate the deposit
    const tx = await spokePool.depositV3(
      userAddress,
      handler,
      tokenAddress,
      ZERO_ADDRESS,
      amount,
      outputAmount,
      destinationChainId,
      quoteData.exclusiveRelayer,
      quoteData.timestamp,
      fillDeadline,
      quoteData.exclusivityDeadline,
      updatedMessage
    );

    console.log("Deposit transaction sent:", tx.hash);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log("Deposit transaction confirmed:", receipt.transactionHash);

    return receipt.transactionHash;
  } catch (error) {
    console.error("Error initiating bridge deposit:", error);
    throw error;
  }
}


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


function generateMessageForMulticallHandler(
  userAddress,
  depositAmount,
) {
  const abiCoder = ethers.utils.defaultAbiCoder;

  // Define the ABI of the functions
  const approveFunction = "function approve(address spender, uint256 value)"; 
  const depositFunction = "function deposit(uint assets, address receiver) external returns(uint)"; //YEARN deposit function

  // Create Interface instances
  const erc20Interface = new ethers.utils.Interface([approveFunction]);
  const yearnInterface = new ethers.utils.Interface([depositFunction]);

  // Encode the function calls with selectors
  const approveCalldata = erc20Interface.encodeFunctionData("approve", [yearnVaultAddress, depositAmount]);

  const depositCalldata = yearnInterface.encodeFunctionData("deposit", [depositAmount, userAddress]);

  // Encode the Instructions object
  return abiCoder.encode(
    [
      "tuple(" +
        "tuple(" +
          "address target," +
          "bytes callData," +
          "uint256 value" +
        ")[]," +
        "address fallbackRecipient" +
      ")"
    ],
    [
      [
        [
          [vaultAsset, approveCalldata, 0],
          [yearnVaultAddress, depositCalldata, 0]
        ],
        userAddress
      ]
    ]
  );
}
