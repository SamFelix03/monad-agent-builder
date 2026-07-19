const { ethers } = require('ethers');
const axios = require('axios');
const {
  MONAD_TESTNET_RPC,
  KURU_FLOW_API,
  NATIVE_MON_ADDRESS,
  monadExplorerTxUrl,
} = require('../network');
const { storeQuote, getQuote, consumeQuote } = require('./quoteStore');

const TOKEN_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeToken(address) {
  if (!address) return NATIVE_MON_ADDRESS;
  const lower = address.toLowerCase();
  if (lower === 'native' || lower === 'mon' || lower === NATIVE_MON_ADDRESS.toLowerCase()) {
    return NATIVE_MON_ADDRESS;
  }
  return address;
}

async function getKuruFlowToken(userAddress) {
  const response = await axios.post(`${KURU_FLOW_API}/api/generate-token`, {
    user_address: userAddress,
  });
  if (!response.data?.token) throw new Error('Kuru Flow did not return an auth token');
  return response.data.token;
}

async function getKuruSwapQuote({
  userAddress,
  tokenIn,
  tokenOut,
  amountWei,
  slippageTolerance,
  authToken,
}) {
  const slippageBps = Math.min(10000, Math.max(1, Math.round(slippageTolerance * 100)));
  const response = await axios.post(
    `${KURU_FLOW_API}/api/quote`,
    {
      userAddress,
      tokenIn,
      tokenOut,
      amount: amountWei.toString(),
      slippageTolerance: slippageBps,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
  return response.data;
}

async function getTokenDecimals(contract) {
  try {
    return await contract.decimals();
  } catch {
    return 18;
  }
}

async function checkBalance(tokenContract, walletAddress, amountWei, decimals) {
  const balance = await tokenContract.balanceOf(walletAddress);
  if (balance < amountWei) {
    const amountReadable = ethers.formatUnits(amountWei, decimals);
    const balanceReadable = ethers.formatUnits(balance, decimals);
    throw new Error(`Insufficient balance: need ${amountReadable}, have ${balanceReadable}`);
  }
}

async function approveToken(tokenContract, spenderAddress, amountWei, wallet, decimals) {
  const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
  if (currentAllowance >= amountWei) {
    return { hash: null, success: true };
  }
  let gasLimit;
  try {
    const gasEstimate = await tokenContract.approve.estimateGas(spenderAddress, amountWei);
    gasLimit = (gasEstimate * 120n) / 100n;
  } catch {
    gasLimit = 100000;
  }
  const tx = await tokenContract.approve(spenderAddress, amountWei, { gasLimit });
  const receipt = await tx.wait();
  await sleep(3000);
  return { hash: receipt.hash, success: receipt.status === 1 };
}

async function estimateNotionalUsd(tokenIn, amountIn, fetchPriceFn) {
  try {
    const query = tokenIn === NATIVE_MON_ADDRESS ? 'monad' : tokenIn;
    const price = await fetchPriceFn(query);
    const usd = price?.usd || price?.price || 0;
    return Math.round(parseFloat(amountIn) * parseFloat(usd) * 100) / 100;
  } catch {
    return null;
  }
}

async function buildSwapQuote({ privateKey, tokenIn, tokenOut, amountIn, slippageTolerance = 1, fetchPriceFn }) {
  const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  const normalizedTokenIn = normalizeToken(tokenIn);
  const normalizedTokenOut = normalizeToken(tokenOut);
  const isNativeIn = normalizedTokenIn === NATIVE_MON_ADDRESS;

  let decimalsIn = 18;
  let amountInWei;

  if (isNativeIn) {
    amountInWei = ethers.parseEther(amountIn.toString());
    const balance = await provider.getBalance(wallet.address);
    if (balance < amountInWei) {
      throw new Error('Insufficient native MON balance');
    }
  } else {
    const tokenInContract = new ethers.Contract(normalizedTokenIn, TOKEN_ABI, wallet);
    decimalsIn = await getTokenDecimals(tokenInContract);
    amountInWei = ethers.parseUnits(amountIn.toString(), decimalsIn);
    await checkBalance(tokenInContract, wallet.address, amountInWei, decimalsIn);
  }

  const authToken = await getKuruFlowToken(wallet.address);
  const quote = await getKuruSwapQuote({
    userAddress: wallet.address,
    tokenIn: normalizedTokenIn,
    tokenOut: normalizedTokenOut,
    amountWei: amountInWei,
    slippageTolerance,
    authToken,
  });

  if (quote.status !== 'success') {
    throw new Error(quote.message || 'Kuru Flow quote failed');
  }

  const notional_usd = fetchPriceFn
    ? await estimateNotionalUsd(normalizedTokenIn, amountIn, fetchPriceFn)
    : null;

  const stored = storeQuote({
    walletAddress: wallet.address,
    privateKey,
    tokenIn: normalizedTokenIn,
    tokenOut: normalizedTokenOut,
    amountIn: amountIn.toString(),
    amountInWei: amountInWei.toString(),
    slippageTolerance,
    isNativeIn,
    decimalsIn,
    kuruQuote: quote,
    notional_usd,
    agentId: null,
  });

  return {
    success: true,
    quoteId: stored.id,
    wallet: wallet.address,
    tokenIn: normalizedTokenIn,
    tokenOut: normalizedTokenOut,
    amountIn: amountIn.toString(),
    slippageTolerance,
    expectedOutput: quote.output,
    minOutput: quote.minOut,
    notional_usd,
    expiresAt: new Date(stored.expiresAt).toISOString(),
    aggregator: 'kuru-flow',
  };
}

async function executeSwapFromQuote({ quoteId, slippageTolerance, privateKey: overrideKey }) {
  const entry = consumeQuote(quoteId);
  if (!entry) {
    throw new Error('Quote expired or not found. Request a new quote_swap.');
  }

  const privateKey = overrideKey || entry.privateKey;
  const slippage = slippageTolerance ?? entry.slippageTolerance;

  const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  const quote = entry.kuruQuote;
  const routerAddress = quote.transaction.to;
  let approveTxHash = null;

  if (!entry.isNativeIn) {
    const tokenInContract = new ethers.Contract(entry.tokenIn, TOKEN_ABI, wallet);
    const amountInWei = BigInt(entry.amountInWei);
    const approveResult = await approveToken(
      tokenInContract,
      routerAddress,
      amountInWei,
      wallet,
      entry.decimalsIn
    );
    approveTxHash = approveResult.hash;
    if (!approveResult.success) throw new Error('Token approval failed');
  }

  const calldata = quote.transaction.calldata.startsWith('0x')
    ? quote.transaction.calldata
    : `0x${quote.transaction.calldata}`;

  const tx = await wallet.sendTransaction({
    to: routerAddress,
    data: calldata,
    value: BigInt(quote.transaction.value || '0'),
  });
  const receipt = await tx.wait();

  if (receipt.status !== 1) throw new Error('Swap transaction failed');

  return {
    success: true,
    quoteId,
    wallet: wallet.address,
    tokenIn: entry.tokenIn,
    tokenOut: entry.tokenOut,
    amountIn: entry.amountIn,
    slippageTolerance: slippage,
    aggregator: 'kuru-flow',
    expectedOutput: quote.output,
    minOutput: quote.minOut,
    swapRouterAddress: routerAddress,
    approveTxHash,
    swapTxHash: receipt.hash,
    notional_usd: entry.notional_usd,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    explorerUrl: monadExplorerTxUrl(receipt.hash),
  };
}

module.exports = {
  normalizeToken,
  getKuruFlowToken,
  getKuruSwapQuote,
  buildSwapQuote,
  executeSwapFromQuote,
  getQuote,
  TOKEN_ABI,
  NATIVE_MON_ADDRESS,
};
