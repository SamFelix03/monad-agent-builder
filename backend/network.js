/**
 * Monad Testnet network configuration.
 * @see https://docs.monad.xyz/developer-essentials/testnets
 */
const MONAD_TESTNET_RPC =
  process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

const MONAD_CHAIN_ID = 10143;

const MONAD_MORALIS_CHAIN = process.env.MORALIS_CHAIN || '0x279f'; // 10143

const NATIVE_SYMBOL = 'MON';

// Kuru Flow aggregator (Monad swaps)
const KURU_FLOW_API = process.env.KURU_FLOW_API || 'https://ws.kuru.io';

// Native MON sentinel used by Kuru Flow
const NATIVE_MON_ADDRESS = '0x0000000000000000000000000000000000000000';

// Canonical Wrapped MON on Monad Testnet
const WMON_ADDRESS =
  process.env.WMON_ADDRESS ||
  '0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541';

const monadExplorerTxUrl = (txHash) =>
  `https://testnet.monadvision.com/tx/${txHash}`;

const monadExplorerAddressUrl = (address) =>
  `https://testnet.monadvision.com/address/${address}`;

// Deployed factory contracts on Monad Testnet (override via .env)
const FACTORY_ADDRESS =
  process.env.TOKEN_FACTORY_ADDRESS ||
  '0x26D215752f68bc2254186F9f6FF068b8C4BdFd37';
const NFT_FACTORY_ADDRESS =
  process.env.NFT_FACTORY_ADDRESS ||
  '0x3EA6D1c84481f89aac255a7ABC375fe761653cdA';
const DAO_FACTORY_ADDRESS =
  process.env.DAO_FACTORY_ADDRESS ||
  '0x1E491de1a08843079AAb4cFA516C717597344e50';
const AIRDROP_CONTRACT_ADDRESS =
  process.env.AIRDROP_CONTRACT_ADDRESS ||
  '0x14d42947929F1ECf882aA6a07dd4279ADb49345d';
const YIELD_CALCULATOR_ADDRESS =
  process.env.YIELD_CALCULATOR_ADDRESS ||
  '0xC6Ffc4E56388fFa99EA18503a0Ea518e795ceCC8';

function getMoralisApiKey() {
  return process.env.MORALIS_API_KEY?.trim() || null;
}

module.exports = {
  MONAD_TESTNET_RPC,
  MONAD_CHAIN_ID,
  MONAD_MORALIS_CHAIN,
  NATIVE_SYMBOL,
  KURU_FLOW_API,
  NATIVE_MON_ADDRESS,
  WMON_ADDRESS,
  monadExplorerTxUrl,
  monadExplorerAddressUrl,
  FACTORY_ADDRESS,
  NFT_FACTORY_ADDRESS,
  DAO_FACTORY_ADDRESS,
  AIRDROP_CONTRACT_ADDRESS,
  YIELD_CALCULATOR_ADDRESS,
  getMoralisApiKey,
};
