const express = require('express');
const { ethers } = require('ethers');
const solc = require('solc');
const axios = require('axios');
const FormData = require('form-data');
const Groq = require('groq-sdk');
const YieldCalculatorTool = require('./yieldCalculator');
const {
  MONAD_TESTNET_RPC,
  MONAD_MORALIS_CHAIN,
  NATIVE_SYMBOL,
  KURU_FLOW_API,
  NATIVE_MON_ADDRESS,
  WMON_ADDRESS,
  monadExplorerTxUrl,
  FACTORY_ADDRESS,
  NFT_FACTORY_ADDRESS,
  DAO_FACTORY_ADDRESS,
  AIRDROP_CONTRACT_ADDRESS,
  YIELD_CALCULATOR_ADDRESS,
  getMoralisApiKey,
} = require('./network');
require('dotenv').config();

const { registerExtensionRoutes } = require('./routes/extensions');
const { executeSwapFromQuote } = require('./lib/swapService');

const app = express();
app.use(express.json());

function requireContractAddress(address, envName) {
  if (!address) {
    throw new Error(
      `${envName} is not set. Deploy contracts to Monad Testnet and set the address in .env`
    );
  }
}

async function getKuruFlowToken(userAddress) {
  const response = await axios.post(`${KURU_FLOW_API}/api/generate-token`, {
    user_address: userAddress,
  });
  if (!response.data?.token) {
    throw new Error('Kuru Flow did not return an auth token');
  }
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

// TokenFactory ABI
const FACTORY_ABI = [
  "function createToken(string name, string symbol, uint256 initialSupply) returns (address)",
  "function getTotalTokensDeployed() view returns (uint256)",
  "function getTokensByCreator(address creator) view returns (address[])",
  "function getLatestTokens(uint256 count) view returns (address[])",
  "function getAllDeployedTokens() view returns (address[])",
  "function getTokenInfo(address tokenAddress) view returns (address creator, string name, string symbol, uint256 initialSupply, uint256 deployedAt, uint256 currentSupply, address owner)",
  "event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, uint256 initialSupply, uint256 timestamp)"
];

// NFTFactory ABI
const NFT_FACTORY_ABI = [
  "function createCollection(string memory name, string memory symbol, string memory baseURI) external returns (address)",
  "function getCollectionsByCreator(address creator) external view returns (address[] memory)",
  "function getCollectionInfo(address collectionAddress) external view returns (address creator, string memory name, string memory symbol, string memory baseURI, uint256 deployedAt, uint256 totalMinted, address owner)",
  "event CollectionCreated(address indexed collectionAddress, address indexed creator, string name, string symbol, string baseURI, uint256 timestamp)"
];

// DAOFactory ABI
const DAO_FACTORY_ABI = [
  "function createDAO(string memory _name, uint256 _votingPeriod, uint256 _quorumPercentage) external returns (address)",
  "function getDAOCount() external view returns (uint256)",
  "function getCreatorDAOs(address _creator) external view returns (address[] memory)",
  "function getAllDAOs() external view returns (address[] memory)",
  "event DAOCreated(address indexed daoAddress, string name, address indexed creator, uint256 votingPeriod, uint256 quorumPercentage)"
];

// DAO ABI (for interacting with created DAOs)
const DAO_ABI = [
  "function name() external view returns (string memory)",
  "function owner() external view returns (address)",
  "function memberCount() external view returns (uint256)",
  "function votingPeriod() external view returns (uint256)",
  "function quorumPercentage() external view returns (uint256)",
  "function proposalCount() external view returns (uint256)",
  "function getTotalVotingPower() public view returns (uint256)",
  "function getAllMembers() external view returns (address[] memory)",
  "function getMemberInfo(address _member) external view returns (bool isMember, uint256 votingPower, uint256 joinedAt)"
];

// Airdrop Contract ABI
const AIRDROP_ABI = [
  "function airdrop(address[] calldata recipients, uint256 amount) payable",
  "function getBalance() view returns (uint256)",
  "event AirdropExecuted(address indexed executor, address[] recipients, uint256 amount, uint256 totalAmount, uint256 timestamp)"
];

// ERC20 Token Contract Source
const TOKEN_CONTRACT_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract CustomToken {
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;
    address public owner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) {
        owner = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _totalSupply = totalSupply_;
        _balances[msg.sender] = totalSupply_;
        emit Transfer(address(0), msg.sender, totalSupply_);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) public view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _transfer(from, to, amount);
        _approve(from, msg.sender, currentAllowance - amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        require(_balances[from] >= amount, "ERC20: transfer amount exceeds balance");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");
        _allowances[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }

    function sendToken(address recipient, uint256 amount) external onlyOwner {
        _transfer(address(this), recipient, amount);
    }
}
`;

// Compile Solidity contract
function compileContract() {
  const input = {
    language: 'Solidity',
    sources: {
      'CustomToken.sol': {
        content: TOKEN_CONTRACT_SOURCE
      }
    },
    settings: {
      optimizer: {
        enabled: false,
        runs: 200
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  // Log compilation warnings
  if (output.errors) {
    const warnings = output.errors.filter(e => e.severity === 'warning');
    if (warnings.length > 0) {
      console.warn('Compilation warnings:', warnings);
    }
    
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      throw new Error('Compilation failed: ' + JSON.stringify(errors, null, 2));
    }
  }

  if (!output.contracts || !output.contracts['CustomToken.sol'] || !output.contracts['CustomToken.sol']['CustomToken']) {
    throw new Error('Contract not found in compilation output');
  }

  const contract = output.contracts['CustomToken.sol']['CustomToken'];
  
  if (!contract.abi) {
    throw new Error('ABI not found in compilation output');
  }
  
  if (!contract.evm || !contract.evm.bytecode || !contract.evm.bytecode.object) {
    throw new Error('Bytecode not found in compilation output');
  }

  let bytecode = contract.evm.bytecode.object;
  
  // Ensure bytecode has 0x prefix
  if (!bytecode.startsWith('0x')) {
    bytecode = '0x' + bytecode;
  }
  
  if (bytecode === '0x' || bytecode.length < 4) {
    throw new Error('Invalid bytecode generated');
  }

  return {
    abi: contract.abi,
    bytecode: bytecode
  };
}

app.post('/transfer', async (req, res) => {
  try {
    const { privateKey, toAddress, amount, tokenAddress } = req.body;

    if (!privateKey || !toAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, toAddress, amount'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // If tokenAddress is provided, transfer ERC20 tokens
    if (tokenAddress) {
      console.log('Transferring ERC20 token:', tokenAddress);
      
      // ERC20 Token ABI for transfer
      const TOKEN_ABI = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)'
      ];

      const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, wallet);

      // Get token decimals
      let decimals;
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid token address or token does not support decimals()'
        });
      }

      // Parse amount with proper decimals
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);

      // Check token balance
      const tokenBalance = await tokenContract.balanceOf(wallet.address);
      if (tokenBalance < amountInWei) {
        const tokenSymbol = await tokenContract.symbol().catch(() => 'TOKEN');
        return res.status(400).json({
          success: false,
          error: 'Insufficient token balance',
          tokenAddress: tokenAddress,
          tokenSymbol: tokenSymbol,
          currentBalance: ethers.formatUnits(tokenBalance, decimals),
          requestedAmount: amount.toString()
        });
      }

      // Transfer tokens
      console.log(`Transferring ${amount} tokens (${amountInWei.toString()} with ${decimals} decimals)`);
      const tx = await tokenContract.transfer(toAddress, amountInWei);
      const receipt = await tx.wait();

      const tokenSymbol = await tokenContract.symbol().catch(() => 'TOKEN');
      const tokenName = await tokenContract.name().catch(() => 'Token');

      return res.json({
        success: true,
        type: 'ERC20',
        transactionHash: receipt.hash,
        from: wallet.address,
        to: toAddress,
        tokenAddress: tokenAddress,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        amount: amount,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl: monadExplorerTxUrl(receipt.hash)
      });
    }

    // Native token transfer (original behavior)
    console.log('Transferring native token (MON)');
    const balance = await provider.getBalance(wallet.address);
    const amountInWei = ethers.parseEther(amount.toString());

    if (balance < amountInWei) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        currentBalance: ethers.formatEther(balance)
      });
    }

    const tx = {
      to: toAddress,
      value: amountInWei,
    };

    const transactionResponse = await wallet.sendTransaction(tx);
    const receipt = await transactionResponse.wait();

    return res.json({
      success: true,
      type: 'native',
      transactionHash: receipt.hash,
      from: wallet.address,
      to: toAddress,
      amount: amount,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: monadExplorerTxUrl(receipt.hash)
    });

  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// Deploy ERC20 Token endpoint using TokenFactory
app.post('/deploy-token', async (req, res) => {
  try {
    const { 
      privateKey, 
      name, 
      symbol, 
      initialSupply 
    } = req.body;

    // Validation
    if (!privateKey || !name || !symbol || !initialSupply) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, name, symbol, initialSupply'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check balance for gas
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.formatEther(balance), 'MON');
    
    if (balance === 0n) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance for gas fees',
        currentBalance: ethers.formatEther(balance),
        required: 'Some testnet tokens for gas'
      });
    }

    console.log('Creating token via TokenFactory:', { name, symbol, initialSupply });
    console.log('Factory address:', FACTORY_ADDRESS);

    // Connect to TokenFactory contract
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

    // Convert initialSupply to BigInt (assuming it's provided as a number/string)
    const initialSupplyBigInt = BigInt(initialSupply.toString());

    // Estimate gas before sending transaction (for logging and optional gas limit)
    console.log('Estimating gas for createToken...');
    let gasEstimate;
    let estimatedCost = null;
    try {
      gasEstimate = await factory.createToken.estimateGas(name, symbol, initialSupplyBigInt);
      console.log('Estimated gas:', gasEstimate.toString());
      
      // Get current gas price for informational purposes only
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      
      if (gasPrice && gasPrice > 0n) {
        estimatedCost = gasEstimate * gasPrice;
        console.log('Estimated transaction cost:', ethers.formatEther(estimatedCost), 'MON');
        console.log('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
        
        // Only warn if balance seems insufficient, but don't block the transaction
        // Let the network reject it if truly insufficient
        if (balance < estimatedCost) {
          console.warn('⚠️  Warning: Balance may be insufficient for transaction');
          console.warn('   Balance:', ethers.formatEther(balance), 'MON');
          console.warn('   Estimated cost:', ethers.formatEther(estimatedCost), 'MON');
          // Continue anyway - let the transaction fail naturally if needed
        }
      }
    } catch (estimateError) {
      console.warn('Gas estimation failed (will proceed anyway):', estimateError.message);
      // If estimation fails, we'll still try to send - ethers will handle it
      gasEstimate = null;
    }

    // Create token via factory with estimated gas
    console.log('Sending createToken transaction...');
    let tx;
    if (gasEstimate) {
      // Add 20% buffer to gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;
      console.log('Using gas limit:', gasLimit.toString());
      tx = await factory.createToken(name, symbol, initialSupplyBigInt, { gasLimit });
    } else {
      // Let ethers estimate automatically if our estimation failed
      tx = await factory.createToken(name, symbol, initialSupplyBigInt);
    }
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // Parse the TokenCreated event to get the token address
    const factoryInterface = new ethers.Interface(FACTORY_ABI);
    let newTokenAddress = null;
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'TokenCreated') {
          newTokenAddress = parsedLog.args.tokenAddress;
          break;
        }
      } catch (e) {
        // Not the event we're looking for
      }
    }

    if (!newTokenAddress) {
      throw new Error('TokenCreated event not found in transaction receipt. Token creation may have failed.');
    }

    console.log('Token created at address:', newTokenAddress);

    // IMPORTANT: The tokens are minted to the factory contract, not the creator
    // We need to check the factory's balance and transfer tokens to the creator
    const TOKEN_ABI = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function owner() view returns (address)',
      'function mint(address to, uint256 amount) returns ()'
    ];
    
    const tokenContract = new ethers.Contract(newTokenAddress, TOKEN_ABI, wallet);
    
    // Check factory's token balance
    const factoryBalance = await tokenContract.balanceOf(FACTORY_ADDRESS);
    const tokenDecimals = await tokenContract.decimals().catch(() => 18);
    const expectedSupply = BigInt(initialSupply.toString()) * (10n ** BigInt(tokenDecimals));
    
    console.log(`Factory token balance: ${ethers.formatUnits(factoryBalance, tokenDecimals)}`);
    console.log(`Expected supply: ${ethers.formatUnits(expectedSupply, tokenDecimals)}`);
    
    // Try to transfer tokens from factory to creator
    // Since the factory owns the tokens initially, we need to use the owner's mint function
    // OR if the factory has a way to transfer, we'd use that
    // For now, check if creator is owner and can mint (though this increases supply)
    let transferSuccess = false;
    let transferTxHash = null;
    
    try {
      const tokenOwner = await tokenContract.owner();
      console.log(`Token owner: ${tokenOwner}`);
      console.log(`Creator wallet: ${wallet.address}`);
      
      if (tokenOwner.toLowerCase() === wallet.address.toLowerCase()) {
        // Creator is the owner - we can mint new tokens to the creator
        // But this increases total supply, so we'll check if factory has tokens first
        if (factoryBalance > 0n) {
          console.log('⚠️  Tokens are in factory contract. Attempting to use mint function...');
          // Note: Minting will increase total supply, but it's the only way without modifying factory
          // Actually, we can't transfer from factory without factory's approval
          // So we'll mint equivalent tokens to creator
          const mintTx = await tokenContract.mint(wallet.address, initialSupplyBigInt);
          const mintReceipt = await mintTx.wait();
          transferSuccess = true;
          transferTxHash = mintReceipt.hash;
          console.log(`✅ Minted ${initialSupply} tokens to creator: ${mintReceipt.hash}`);
        }
      } else {
        console.log('⚠️  Creator is not the token owner. Cannot mint tokens.');
      }
    } catch (transferError) {
      console.warn('Could not transfer/mint tokens to creator:', transferError.message);
      // Continue anyway - user can manually transfer later if needed
    }

    // Optionally get token info from factory
    let tokenInfo = null;
    try {
      const info = await factory.getTokenInfo(newTokenAddress);
      tokenInfo = {
        name: info.name,
        symbol: info.symbol,
        initialSupply: info.initialSupply.toString(),
        currentSupply: ethers.formatUnits(info.currentSupply, 18),
        creator: info.creator,
        owner: info.owner,
        deployedAt: new Date(Number(info.deployedAt) * 1000).toISOString()
      };
    } catch (infoError) {
      console.warn('Could not fetch token info from factory:', infoError.message);
      // Fallback to basic info
      tokenInfo = {
        name,
        symbol,
        initialSupply: initialSupply.toString()
      };
    }
    
    // Check creator's final balance
    const creatorBalance = await tokenContract.balanceOf(wallet.address);

    return res.json({
      success: true,
      message: 'Token created successfully via TokenFactory',
      contractAddress: newTokenAddress,
      tokenInfo: tokenInfo,
      creator: wallet.address,
      factoryAddress: FACTORY_ADDRESS,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: monadExplorerTxUrl(tx.hash),
      tokenTransfer: {
        success: transferSuccess,
        method: transferSuccess ? 'minted' : 'none',
        transactionHash: transferTxHash,
        note: transferSuccess 
          ? `Tokens minted to your wallet. Note: This increases total supply.` 
          : `Initial tokens are in factory contract. You may need to mint tokens using the owner's mint function.`
      },
      balances: {
        factory: ethers.formatUnits(factoryBalance, tokenDecimals),
        creator: ethers.formatUnits(creatorBalance, tokenDecimals),
        expected: initialSupply.toString()
      },
      note: transferSuccess 
        ? `${initialSupply} tokens have been minted to your wallet address.`
        : `⚠️  Initial tokens (${initialSupply}) are in the factory contract. You are the token owner and can mint tokens using the mint function.`,
      nextSteps: transferSuccess ? [
        `✅ ${initialSupply} tokens are now in your wallet: ${wallet.address}`,
        `To transfer tokens to someone, use the /transfer endpoint with:`,
        `  - privateKey: Your wallet private key`,
        `  - toAddress: Recipient's wallet address`,
        `  - amount: Amount of tokens to send (as a number, e.g., "100")`,
        `  - tokenAddress: ${newTokenAddress}`
      ] : [
        `⚠️  Note: Initial tokens are in the factory contract (${FACTORY_ADDRESS})`,
        `You are the token owner and can mint tokens using the token contract's mint function.`,
        `To transfer tokens to someone, first ensure you have tokens in your wallet, then use the /transfer endpoint.`
      ]
    });

  } catch (error) {
    console.error('Deploy token error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// Deploy ERC-721 NFT Collection endpoint using NFTFactory
app.post('/deploy-nft-collection', async (req, res) => {
  try {
    const { 
      privateKey, 
      name, 
      symbol, 
      baseURI 
    } = req.body;

    // Validation
    if (!privateKey || !name || !symbol || !baseURI) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, name, symbol, baseURI'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check balance for gas
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.formatEther(balance), 'MON');
    
    if (balance === 0n) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance for gas fees',
        currentBalance: ethers.formatEther(balance),
        required: 'Some testnet tokens for gas'
      });
    }

    console.log('Creating NFT collection via NFTFactory:', { name, symbol, baseURI });
    console.log('Factory address:', NFT_FACTORY_ADDRESS);

    // Connect to NFTFactory contract
    const factory = new ethers.Contract(NFT_FACTORY_ADDRESS, NFT_FACTORY_ABI, wallet);

    // Estimate gas before sending transaction (for logging and optional gas limit)
    console.log('Estimating gas for createCollection...');
    let gasEstimate;
    let estimatedCost = null;
    try {
      gasEstimate = await factory.createCollection.estimateGas(name, symbol, baseURI);
      console.log('Estimated gas:', gasEstimate.toString());
      
      // Get current gas price for informational purposes only
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      
      if (gasPrice && gasPrice > 0n) {
        estimatedCost = gasEstimate * gasPrice;
        console.log('Estimated transaction cost:', ethers.formatEther(estimatedCost), 'MON');
        console.log('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
        
        // Only warn if balance seems insufficient, but don't block the transaction
        if (balance < estimatedCost) {
          console.warn('⚠️  Warning: Balance may be insufficient for transaction');
          console.warn('   Balance:', ethers.formatEther(balance), 'MON');
          console.warn('   Estimated cost:', ethers.formatEther(estimatedCost), 'MON');
        }
      }
    } catch (estimateError) {
      console.warn('Gas estimation failed (will proceed anyway):', estimateError.message);
      gasEstimate = null;
    }

    // Create collection via factory with estimated gas
    console.log('Sending createCollection transaction...');
    let tx;
    if (gasEstimate) {
      // Add 20% buffer to gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;
      console.log('Using gas limit:', gasLimit.toString());
      tx = await factory.createCollection(name, symbol, baseURI, { gasLimit });
    } else {
      // Let ethers estimate automatically if our estimation failed
      tx = await factory.createCollection(name, symbol, baseURI);
    }
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // Parse the CollectionCreated event to get the collection address
    const factoryInterface = new ethers.Interface(NFT_FACTORY_ABI);
    let collectionAddress = null;
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'CollectionCreated') {
          collectionAddress = parsedLog.args.collectionAddress;
          break;
        }
      } catch (e) {
        // Not the event we're looking for
      }
    }

    if (!collectionAddress) {
      throw new Error('CollectionCreated event not found in transaction receipt. Collection creation may have failed.');
    }

    console.log('NFT collection created at address:', collectionAddress);

    // Optionally get collection info from factory
    let collectionInfo = null;
    try {
      const info = await factory.getCollectionInfo(collectionAddress);
      collectionInfo = {
        name: info.name,
        symbol: info.symbol,
        baseURI: info.baseURI,
        totalMinted: info.totalMinted.toString(),
        creator: info.creator,
        owner: info.owner,
        deployedAt: new Date(Number(info.deployedAt) * 1000).toISOString()
      };
    } catch (infoError) {
      console.warn('Could not fetch collection info from factory:', infoError.message);
      // Fallback to basic info
      collectionInfo = {
        name,
        symbol,
        baseURI
      };
    }

    return res.json({
      success: true,
      message: 'NFT collection created successfully via NFTFactory',
      collectionAddress: collectionAddress,
      collectionInfo: collectionInfo,
      creator: wallet.address,
      factoryAddress: NFT_FACTORY_ADDRESS,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: monadExplorerTxUrl(tx.hash)
    });

  } catch (error) {
    console.error('Deploy NFT collection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// NFT Collection ABI for minting
const NFT_COLLECTION_ABI = [
  "function mint(address to) returns (uint256)",
  "function mintWithURI(address to, string memory uri) returns (uint256)",
  "function owner() view returns (address)",
  "function totalMinted() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

// Function to upload JSON metadata to IPFS using Pinata
async function uploadToIPFS(metadata) {
  try {
    const PINATA_API_KEY = process.env.PINATA_API_KEY;
    const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

    // If Pinata keys are not set, use public IPFS gateway (for demo - not recommended for production)
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.warn('⚠️  PINATA_API_KEY or PINATA_SECRET_KEY not set in .env');
      console.warn('   Using alternative method - uploading to public IPFS gateway');
      
      // Alternative: Use NFT.Storage or web3.storage
      // For now, return a placeholder that user needs to upload manually
      // Or use a free service like Pinata public gateway
      throw new Error('IPFS upload requires PINATA_API_KEY and PINATA_SECRET_KEY in .env file. Please add them.');
    }

    // Convert metadata to JSON string
    const metadataJSON = JSON.stringify(metadata);
    
    // Create FormData for Pinata
    const formData = new FormData();
    formData.append('file', Buffer.from(metadataJSON), {
      filename: 'metadata.json',
      contentType: 'application/json'
    });

    // Pinata pinJSONToIPFS endpoint
    const pinataMetadata = JSON.stringify({
      name: `NFT Metadata - ${metadata.name || 'Untitled'}`,
    });

    formData.append('pinataMetadata', pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', pinataOptions);

    // Upload to Pinata
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;
    
    console.log('✅ Metadata uploaded to IPFS:', ipfsUrl);
    return ipfsUrl;

  } catch (error) {
    console.error('IPFS upload error:', error.message);
    
    // If Pinata fails, try alternative: upload metadata JSON to a folder structure
    // For this, we'll use Pinata's pinJSONToIPFS for the baseURI folder
    if (error.message.includes('PINATA')) {
      throw error;
    }
    
    // Try using pinJSONToIPFS directly (simpler but less flexible)
    try {
      const PINATA_API_KEY = process.env.PINATA_API_KEY;
      const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

      if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
        throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY required for IPFS upload');
      }

      const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        pinataContent: metadata,
        pinataMetadata: {
          name: `metadata-${Date.now()}.json`
        }
      }, {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      });

      const ipfsHash = response.data.IpfsHash;
      const ipfsUrl = `ipfs://${ipfsHash}`;
      
      console.log('✅ Metadata uploaded to IPFS:', ipfsUrl);
      return ipfsUrl;
    } catch (fallbackError) {
      throw new Error(`IPFS upload failed: ${fallbackError.message}`);
    }
  }
}

// Function to upload directory structure to IPFS (for baseURI)
async function uploadBaseURIToIPFS(collectionName, collectionSymbol) {
  try {
    const PINATA_API_KEY = process.env.PINATA_API_KEY;
    const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY required for IPFS upload');
    }

    // Create a placeholder metadata file for the directory
    const placeholderMetadata = {
      name: `${collectionName} - Token #1`,
      description: `An NFT from ${collectionName} collection`,
      image: "ipfs://placeholder", // User should upload images separately
      attributes: []
    };

    // For baseURI, we'll return a Pinata IPFS gateway URL structure
    // Users will upload individual token metadata files later
    // For now, we'll create a directory structure reference
    const directoryMetadata = {
      name: `${collectionName} Collection`,
      description: `Base directory for ${collectionName} NFT metadata`,
      collection: collectionName,
      symbol: collectionSymbol
    };

    const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      pinataContent: directoryMetadata,
      pinataMetadata: {
        name: `${collectionSymbol}-base-directory`
      }
    }, {
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });

    const ipfsHash = response.data.IpfsHash;
    // Return baseURI pointing to this directory (tokens will be numbered: 1, 2, 3, etc.)
    const baseURI = `ipfs://${ipfsHash}/`;
    
    console.log('✅ Base directory created on IPFS:', baseURI);
    return baseURI;

  } catch (error) {
    throw new Error(`Failed to create IPFS base directory: ${error.message}`);
  }
}

// Simplified NFT collection creation with automatic IPFS upload
app.post('/create-nft-collection', async (req, res) => {
  try {
    const { 
      privateKey,
      name,
      symbol
    } = req.body;

    // Validation
    if (!privateKey || !name || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, name, symbol'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.formatEther(balance), 'MON');
    
    if (balance === 0n) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance for gas fees',
        currentBalance: ethers.formatEther(balance)
      });
    }

    console.log('🚀 Creating NFT collection with automatic IPFS upload...');
    console.log(`Collection: ${name} (${symbol})`);

    // Step 1: Generate metadata for first NFT
    const firstTokenMetadata = {
      name: `${name} #1`,
      description: `The first NFT from ${name} collection`,
      image: `ipfs://placeholder`, // Users can upload images later
      attributes: [
        {
          trait_type: "Collection",
          value: name
        },
        {
          trait_type: "Token Number",
          value: "1"
        }
      ]
    };

    // Step 2: Upload first token metadata to IPFS
    console.log('📤 Uploading metadata to IPFS...');
    let tokenMetadataIPFS;
    try {
      tokenMetadataIPFS = await uploadToIPFS(firstTokenMetadata);
      console.log('✅ Metadata uploaded:', tokenMetadataIPFS);
    } catch (ipfsError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to upload metadata to IPFS',
        details: ipfsError.message,
        instruction: 'Please set PINATA_API_KEY and PINATA_SECRET_KEY in your .env file'
      });
    }

    // Step 3: Create baseURI directory on IPFS
    // Extract the IPFS hash from the metadata URL and use it as base
    // For simplicity, we'll use a pattern where tokenId is appended
    const ipfsHashMatch = tokenMetadataIPFS.match(/ipfs:\/\/([^\/]+)/);
    if (!ipfsHashMatch) {
      throw new Error('Failed to extract IPFS hash from metadata URL');
    }

    // For baseURI, we'll use a directory structure
    // Since we have the hash, we'll create a parent directory reference
    // In practice, you'd want to pin a directory structure
    // For now, we'll use the hash pattern where {tokenId} gets appended
    const ipfsHash = ipfsHashMatch[1];
    const baseURI = `ipfs://${ipfsHash.substring(0, ipfsHash.length - 2)}/`; // Simplified approach
    
    // Better approach: Use the actual IPFS directory structure
    // Let's upload to a proper directory structure
    let finalBaseURI;
    try {
      finalBaseURI = await uploadBaseURIToIPFS(name, symbol);
      // Update to use directory structure
      const dirHashMatch = finalBaseURI.match(/ipfs:\/\/([^\/]+)/);
      if (dirHashMatch) {
        finalBaseURI = `ipfs://${dirHashMatch[1]}/`;
      }
    } catch (dirError) {
      // Fallback to using metadata hash pattern
      console.warn('Could not create directory structure, using metadata hash pattern');
      finalBaseURI = `ipfs://${ipfsHash.substring(0, 20)}/`; // Simplified pattern
    }

    console.log('📁 Base URI:', finalBaseURI);

    // Step 4: Create NFT collection with IPFS baseURI
    console.log('🏭 Creating NFT collection on blockchain...');
    const factory = new ethers.Contract(NFT_FACTORY_ADDRESS, NFT_FACTORY_ABI, wallet);
    
    let createTx;
    try {
      const gasEstimate = await factory.createCollection.estimateGas(name, symbol, finalBaseURI);
      const gasLimit = (gasEstimate * 120n) / 100n;
      createTx = await factory.createCollection(name, symbol, finalBaseURI, { gasLimit });
    } catch (estimateError) {
      console.warn('Gas estimation failed, proceeding without gas limit');
      createTx = await factory.createCollection(name, symbol, finalBaseURI);
    }

    const createReceipt = await createTx.wait();
    
    // Parse CollectionCreated event
    const factoryInterface = new ethers.Interface(NFT_FACTORY_ABI);
    let collectionAddress = null;
    
    for (const log of createReceipt.logs) {
      try {
        const parsedLog = factoryInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'CollectionCreated') {
          collectionAddress = parsedLog.args.collectionAddress;
          break;
        }
      } catch (e) {}
    }

    if (!collectionAddress) {
      throw new Error('Failed to extract collection address from transaction');
    }

    console.log('✅ Collection created:', collectionAddress);

    // Step 5: Mint first NFT to the wallet owner
    console.log('🎨 Minting first NFT...');
    const nftContract = new ethers.Contract(collectionAddress, NFT_COLLECTION_ABI, wallet);
    
    // Mint with the specific metadata URI
    const mintTx = await nftContract.mintWithURI(wallet.address, tokenMetadataIPFS);
    const mintReceipt = await mintTx.wait();
    
    const totalMinted = await nftContract.totalMinted();
    const tokenId = Number(totalMinted);

    console.log('✅ NFT minted successfully!');

    return res.json({
      success: true,
      message: 'NFT collection created and first NFT minted successfully',
      collection: {
        address: collectionAddress,
        name: name,
        symbol: symbol,
        baseURI: finalBaseURI
      },
      firstNFT: {
        tokenId: tokenId.toString(),
        owner: wallet.address,
        metadataURI: tokenMetadataIPFS,
        metadata: firstTokenMetadata
      },
      transactions: {
        collectionCreation: createReceipt.hash,
        minting: mintReceipt.hash
      },
      blockNumber: mintReceipt.blockNumber,
      gasUsed: (BigInt(createReceipt.gasUsed) + BigInt(mintReceipt.gasUsed)).toString(),
      explorerUrls: {
        collection: monadExplorerTxUrl(createReceipt.hash),
        mint: monadExplorerTxUrl(mintReceipt.hash)
      },
      nextSteps: [
        `Your collection is live at: ${collectionAddress}`,
        `Upload NFT images to IPFS and update metadata`,
        `Use the collection address to mint more NFTs`,
        `Metadata for token #${tokenId} is available at: ${tokenMetadataIPFS}`
      ]
    });

  } catch (error) {
    console.error('Create NFT collection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// Complete NFT creation and minting flow
app.post('/create-and-mint-nft', async (req, res) => {
  try {
    const { 
      privateKey,
      collectionAddress, // Optional: if provided, uses existing collection
      // Collection creation params (if collectionAddress not provided)
      collectionName,
      collectionSymbol,
      baseURI, // Optional: if not provided, will be generated
      // NFT minting params
      recipientAddress, // Address to receive the NFT
      // NFT metadata
      nftName,
      nftDescription,
      imageUrl, // URL or IPFS hash of the image
      attributes // Optional: array of {trait_type, value} objects
    } = req.body;

    // Validation
    if (!privateKey || !recipientAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, recipientAddress'
      });
    }

    // If collectionAddress not provided, need collection creation params
    if (!collectionAddress && (!collectionName || !collectionSymbol)) {
      return res.status(400).json({
        success: false,
        error: 'Either provide collectionAddress or collectionName + collectionSymbol'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.formatEther(balance), 'MON');
    
    if (balance === 0n) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance for gas fees',
        currentBalance: ethers.formatEther(balance)
      });
    }

    let finalCollectionAddress = collectionAddress;
    let finalBaseURI = baseURI;

    // Step 1: Create collection if not provided
    if (!collectionAddress) {
      console.log('Creating new NFT collection...');
      
      // If baseURI not provided, create a placeholder
      if (!finalBaseURI) {
        finalBaseURI = `https://api.example.com/metadata/${collectionSymbol.toLowerCase()}/`;
        console.log('⚠️  No baseURI provided, using placeholder. Update collection baseURI later if needed.');
      }

      const factory = new ethers.Contract(NFT_FACTORY_ADDRESS, NFT_FACTORY_ABI, wallet);
      
      // Estimate and create collection
      let tx;
      try {
        const gasEstimate = await factory.createCollection.estimateGas(
          collectionName, 
          collectionSymbol, 
          finalBaseURI
        );
        const gasLimit = (gasEstimate * 120n) / 100n;
        tx = await factory.createCollection(collectionName, collectionSymbol, finalBaseURI, { gasLimit });
      } catch (estimateError) {
        console.warn('Gas estimation failed, proceeding without gas limit');
        tx = await factory.createCollection(collectionName, collectionSymbol, finalBaseURI);
      }

      const receipt = await tx.wait();
      
      // Parse CollectionCreated event
      const factoryInterface = new ethers.Interface(NFT_FACTORY_ABI);
      for (const log of receipt.logs) {
        try {
          const parsedLog = factoryInterface.parseLog(log);
          if (parsedLog && parsedLog.name === 'CollectionCreated') {
            finalCollectionAddress = parsedLog.args.collectionAddress;
            break;
          }
        } catch (e) {}
      }

      if (!finalCollectionAddress) {
        throw new Error('Failed to extract collection address from transaction');
      }

      console.log('✅ Collection created at:', finalCollectionAddress);
    } else {
      console.log('Using existing collection:', finalCollectionAddress);
    }

    // Step 2: Connect to NFT collection contract
    const nftContract = new ethers.Contract(finalCollectionAddress, NFT_COLLECTION_ABI, wallet);
    
    // Verify ownership (only owner can mint)
    const owner = await nftContract.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Only collection owner can mint NFTs',
        collectionOwner: owner,
        yourAddress: wallet.address
      });
    }

    // Step 3: Generate metadata JSON
    const tokenId = Number((await nftContract.totalMinted())) + 1; // Next token ID
    const metadata = {
      name: nftName || `NFT #${tokenId}`,
      description: nftDescription || `An NFT from ${collectionName || 'collection'}`,
      image: imageUrl || '',
      attributes: attributes || []
    };

    // Construct metadata URI
    // Option 1: If using baseURI with token ID
    let tokenMetadataURI = '';
    if (finalBaseURI && !finalBaseURI.endsWith('/')) {
      finalBaseURI = finalBaseURI + '/';
    }
    
    if (finalBaseURI && finalBaseURI.startsWith('http')) {
      // HTTP/HTTPS baseURI - append token ID
      tokenMetadataURI = `${finalBaseURI}${tokenId}`;
    } else if (finalBaseURI && finalBaseURI.startsWith('ipfs://')) {
      // IPFS baseURI - append token ID
      tokenMetadataURI = `${finalBaseURI}${tokenId}`;
    } else {
      // No baseURI or custom - would need to upload metadata separately
      // For now, we'll use mintWithURI if they provide a custom URI
      tokenMetadataURI = finalBaseURI || '';
    }

    console.log('📝 Generated metadata:', JSON.stringify(metadata, null, 2));
    console.log('🔗 Token metadata URI:', tokenMetadataURI || '(will use baseURI + tokenId)');

    // Step 4: Mint the NFT
    let mintTx;
    if (tokenMetadataURI && !tokenMetadataURI.endsWith(tokenId.toString())) {
      // Custom URI provided - use mintWithURI
      console.log('Minting NFT with custom URI...');
      mintTx = await nftContract.mintWithURI(recipientAddress, tokenMetadataURI);
    } else {
      // Use standard mint (will use baseURI + tokenId)
      console.log('Minting NFT...');
      mintTx = await nftContract.mint(recipientAddress);
    }

    console.log('Transaction hash:', mintTx.hash);
    const mintReceipt = await mintTx.wait();
    console.log('✅ NFT minted successfully');

    // Get final token ID (in case it changed)
    const totalMinted = await nftContract.totalMinted();
    const finalTokenId = Number(totalMinted);
    const finalTokenURI = await nftContract.tokenURI(finalTokenId).catch(() => '');

    return res.json({
      success: true,
      message: 'NFT created and minted successfully',
      collectionAddress: finalCollectionAddress,
      tokenId: finalTokenId.toString(),
      recipient: recipientAddress,
      metadata: metadata,
      metadataURI: finalTokenURI || tokenMetadataURI || `${finalBaseURI}${finalTokenId}`,
      mintTransactionHash: mintReceipt.hash,
      blockNumber: mintReceipt.blockNumber,
      gasUsed: mintReceipt.gasUsed.toString(),
      explorerUrl: monadExplorerTxUrl(mintReceipt.hash),
      nextSteps: tokenMetadataURI ? [] : [
        'Upload the metadata JSON to your storage (IPFS, Arweave, or your server)',
        `Update the collection baseURI to point to your metadata location`,
        `Metadata should be accessible at: ${finalBaseURI}${finalTokenId}`
      ]
    });

  } catch (error) {
    console.error('Create and mint NFT error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// Create DAO endpoint using DAOFactory
app.post('/create-dao', async (req, res) => {
  try {
    const { 
      privateKey,
      name,
      votingPeriod, // in seconds (e.g., 604800 for 7 days)
      quorumPercentage // percentage (e.g., 51 for 51%)
    } = req.body;

    // Validation
    if (!privateKey || !name || !votingPeriod || !quorumPercentage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, name, votingPeriod, quorumPercentage'
      });
    }

    // Validate quorum percentage (should be between 0 and 100)
    const quorum = Number(quorumPercentage);
    if (isNaN(quorum) || quorum < 0 || quorum > 100) {
      return res.status(400).json({
        success: false,
        error: 'quorumPercentage must be a number between 0 and 100'
      });
    }

    // Validate voting period (should be positive)
    const votingPeriodNum = Number(votingPeriod);
    if (isNaN(votingPeriodNum) || votingPeriodNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'votingPeriod must be a positive number (in seconds)'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check balance for gas
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.formatEther(balance), 'MON');
    
    if (balance === 0n) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance for gas fees',
        currentBalance: ethers.formatEther(balance),
        required: 'Some testnet tokens for gas'
      });
    }

    console.log('Creating DAO via DAOFactory:', { name, votingPeriod, quorumPercentage });
    console.log('Factory address:', DAO_FACTORY_ADDRESS);

    // Connect to DAOFactory contract
    const factory = new ethers.Contract(DAO_FACTORY_ADDRESS, DAO_FACTORY_ABI, wallet);

    // Convert to BigInt
    const votingPeriodBigInt = BigInt(votingPeriod.toString());
    const quorumPercentageBigInt = BigInt(quorumPercentage.toString());

    // Estimate gas before sending transaction
    console.log('Estimating gas for createDAO...');
    let gasEstimate;
    let estimatedCost = null;
    try {
      gasEstimate = await factory.createDAO.estimateGas(name, votingPeriodBigInt, quorumPercentageBigInt);
      console.log('Estimated gas:', gasEstimate.toString());
      
      // Get current gas price for informational purposes only
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      
      if (gasPrice && gasPrice > 0n) {
        estimatedCost = gasEstimate * gasPrice;
        console.log('Estimated transaction cost:', ethers.formatEther(estimatedCost), 'MON');
        console.log('Gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
        
        if (balance < estimatedCost) {
          console.warn('⚠️  Warning: Balance may be insufficient for transaction');
          console.warn('   Balance:', ethers.formatEther(balance), 'MON');
          console.warn('   Estimated cost:', ethers.formatEther(estimatedCost), 'MON');
        }
      }
    } catch (estimateError) {
      console.warn('Gas estimation failed (will proceed anyway):', estimateError.message);
      gasEstimate = null;
    }

    // Create DAO via factory with estimated gas
    console.log('Sending createDAO transaction...');
    let tx;
    if (gasEstimate) {
      // Add 20% buffer to gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;
      console.log('Using gas limit:', gasLimit.toString());
      tx = await factory.createDAO(name, votingPeriodBigInt, quorumPercentageBigInt, { gasLimit });
    } else {
      // Let ethers estimate automatically if our estimation failed
      tx = await factory.createDAO(name, votingPeriodBigInt, quorumPercentageBigInt);
    }
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // Parse the DAOCreated event to get the DAO address
    const factoryInterface = new ethers.Interface(DAO_FACTORY_ABI);
    let daoAddress = null;
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = factoryInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'DAOCreated') {
          daoAddress = parsedLog.args.daoAddress;
          break;
        }
      } catch (e) {
        // Not the event we're looking for
      }
    }

    if (!daoAddress) {
      throw new Error('DAOCreated event not found in transaction receipt. DAO creation may have failed.');
    }

    console.log('✅ DAO created at address:', daoAddress);

    // Get DAO info from the created contract
    let daoInfo = null;
    try {
      const daoContract = new ethers.Contract(daoAddress, DAO_ABI, provider);
      daoInfo = {
        name: await daoContract.name(),
        owner: await daoContract.owner(),
        memberCount: (await daoContract.memberCount()).toString(),
        votingPeriod: (await daoContract.votingPeriod()).toString(),
        quorumPercentage: (await daoContract.quorumPercentage()).toString(),
        proposalCount: (await daoContract.proposalCount()).toString(),
        totalVotingPower: (await daoContract.getTotalVotingPower()).toString()
      };
    } catch (infoError) {
      console.warn('Could not fetch DAO info:', infoError.message);
      // Fallback to basic info
      daoInfo = {
        name: name,
        votingPeriod: votingPeriod.toString(),
        quorumPercentage: quorumPercentage.toString()
      };
    }

    // Calculate voting period in days for readability
    const votingPeriodDays = votingPeriodNum / (24 * 60 * 60);

    return res.json({
      success: true,
      message: 'DAO created successfully via DAOFactory',
      dao: {
        address: daoAddress,
        name: daoInfo.name || name,
        owner: daoInfo.owner || wallet.address,
        memberCount: daoInfo.memberCount || '0',
        votingPeriod: {
          seconds: votingPeriod.toString(),
          days: votingPeriodDays.toFixed(2)
        },
        quorumPercentage: daoInfo.quorumPercentage || quorumPercentage.toString(),
        proposalCount: daoInfo.proposalCount || '0',
        totalVotingPower: daoInfo.totalVotingPower || '0'
      },
      creator: wallet.address,
      factoryAddress: DAO_FACTORY_ADDRESS,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: monadExplorerTxUrl(tx.hash),
      nextSteps: [
        `Your DAO is live at: ${daoAddress}`,
        `Add members using addMember or addMembers functions`,
        `Create proposals using createProposal function`,
        `Members can vote using vote function`,
        `Execute proposals after voting period ends using executeProposal`
      ]
    });

  } catch (error) {
    console.error('Create DAO error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// Swap helper functions (from swap.js)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getTokenDecimals(contract) {
  try {
    return await contract.decimals();
  } catch {
    return 18; // Default to 18 if call fails
  }
}

async function checkBalance(tokenContract, walletAddress, amountWei, decimals) {
  const balance = await tokenContract.balanceOf(walletAddress);
  const balanceReadable = ethers.formatUnits(balance, decimals);
  
  console.log(`Token balance: ${balanceReadable}`);
  
  if (balance < amountWei) {
    const amountReadable = ethers.formatUnits(amountWei, decimals);
    console.log(`❌ Insufficient balance! Need ${amountReadable} but have ${balanceReadable}`);
    return false;
  }
  return true;
}

async function approveToken(tokenContract, spenderAddress, amountWei, wallet, decimals) {
  // Check current allowance (for info only)
  const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
  console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, decimals)}`);
  
  // If allowance is sufficient, skip approval
  if (currentAllowance >= amountWei) {
    console.log('✅ Sufficient allowance already exists');
    return { hash: null, success: true };
  }
  
  console.log("Approving tokens...");
  
  // Estimate gas
  let gasLimit;
  try {
    const gasEstimate = await tokenContract.approve.estimateGas(spenderAddress, amountWei);
    gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer
  } catch (e) {
    console.log(`⚠ Gas estimation failed, using fallback: 100000`);
    gasLimit = 100000;
  }
  
  // Send approve transaction
  const tx = await tokenContract.approve(spenderAddress, amountWei, {
    gasLimit: gasLimit
  });
  
  console.log(`Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  
  console.log(`✓ Approved: ${receipt.hash}`);
  console.log(`  Gas used: ${receipt.gasUsed.toString()}\n`);
  
  await sleep(3000); // Wait for state sync
  return { hash: receipt.hash, success: receipt.status === 1 };
}

// Swap via Kuru Flow aggregator — https://docs.monad.xyz/guides/kuru-flow
app.post('/swap', async (req, res) => {
  try {
    const {
      privateKey,
      quoteId,
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance = 5,
    } = req.body;

    // Guarded path: execute from a prior quote_swap quoteId
    if (quoteId) {
      if (!privateKey) {
        return res.status(400).json({
          success: false,
          error: 'privateKey required when executing swap with quoteId',
        });
      }
      const result = await executeSwapFromQuote({ quoteId, slippageTolerance, privateKey });
      return res.json(result);
    }

    if (!privateKey || !tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, tokenIn, tokenOut, amountIn (or quoteId)',
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    const normalizeToken = (address) => {
      if (!address) return NATIVE_MON_ADDRESS;
      const lower = address.toLowerCase();
      if (
        lower === 'native' ||
        lower === 'mon' ||
        lower === NATIVE_MON_ADDRESS.toLowerCase()
      ) {
        return NATIVE_MON_ADDRESS;
      }
      // Keep WMON as its own ERC-20 address — do NOT collapse it to native
      return address;
    };

    const normalizedTokenIn = normalizeToken(tokenIn);
    const normalizedTokenOut = normalizeToken(tokenOut);
    const isNativeIn = normalizedTokenIn === NATIVE_MON_ADDRESS;

    const TOKEN_ABI = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    console.log(`🔍 Swap request from ${wallet.address}`);
    console.log(`   Token In: ${normalizedTokenIn}`);
    console.log(`   Token Out: ${normalizedTokenOut}`);
    console.log(`   Amount: ${amountIn}`);

    let decimalsIn = 18;
    let amountInWei;

    if (isNativeIn) {
      amountInWei = ethers.parseEther(amountIn.toString());
      const balance = await provider.getBalance(wallet.address);
      if (balance < amountInWei) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient native MON balance',
          currentBalance: ethers.formatEther(balance),
        });
      }
    } else {
      const tokenInContract = new ethers.Contract(normalizedTokenIn, TOKEN_ABI, wallet);
      decimalsIn = await getTokenDecimals(tokenInContract);
      amountInWei = ethers.parseUnits(amountIn.toString(), decimalsIn);
      if (
        !(await checkBalance(tokenInContract, wallet.address, amountInWei, decimalsIn))
      ) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient token balance',
        });
      }
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
      return res.status(400).json({
        success: false,
        error: quote.message || 'Kuru Flow quote failed',
        quote,
      });
    }

    const routerAddress = quote.transaction.to;
    let approveTxHash = null;

    if (!isNativeIn) {
      const tokenInContract = new ethers.Contract(normalizedTokenIn, TOKEN_ABI, wallet);
      const approveResult = await approveToken(
        tokenInContract,
        routerAddress,
        amountInWei,
        wallet,
        decimalsIn
      );
      approveTxHash = approveResult.hash;
      if (!approveResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Token approval failed',
        });
      }
    }

    const calldata = quote.transaction.calldata.startsWith('0x')
      ? quote.transaction.calldata
      : `0x${quote.transaction.calldata}`;

    console.log('Executing Kuru Flow swap...');
    const tx = await wallet.sendTransaction({
      to: routerAddress,
      data: calldata,
      value: BigInt(quote.transaction.value || '0'),
    });
    console.log(`Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      return res.json({
        success: true,
        wallet: wallet.address,
        tokenIn: normalizedTokenIn,
        tokenOut: normalizedTokenOut,
        amountIn: amountIn.toString(),
        slippageTolerance,
        aggregator: 'kuru-flow',
        expectedOutput: quote.output,
        minOutput: quote.minOut,
        swapRouterAddress: routerAddress,
        approveTxHash,
        swapTxHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl: monadExplorerTxUrl(receipt.hash),
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Swap transaction failed',
    });
  } catch (error) {
    console.error('Swap error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code,
    });
  }
});


// Airdrop endpoint - batch transfer native MON tokens to multiple addresses
app.post('/airdrop', async (req, res) => {
  try {
    const { 
      privateKey, 
      recipients, 
      amount 
    } = req.body;

    // Validation
    if (!privateKey || !recipients || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, recipients, amount'
      });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'recipients must be a non-empty array of addresses'
      });
    }

    if (Number(amount) <= 0 || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        error: 'amount must be a positive number'
      });
    }

    // Validate all recipient addresses
    const invalidAddresses = recipients.filter(addr => !ethers.isAddress(addr));
    if (invalidAddresses.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient addresses found',
        invalidAddresses: invalidAddresses
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check wallet balance
    const walletBalance = await provider.getBalance(wallet.address);
    const amountPerRecipient = ethers.parseEther(amount.toString());
    const totalAmount = amountPerRecipient * BigInt(recipients.length);

    console.log('Airdrop request:', {
      from: wallet.address,
      recipients: recipients.length,
      amountPerRecipient: amount,
      totalAmount: ethers.formatEther(totalAmount)
    });

    if (walletBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance',
        walletBalance: ethers.formatEther(walletBalance),
        required: ethers.formatEther(totalAmount),
        shortage: ethers.formatEther(totalAmount - walletBalance)
      });
    }

    // Connect to Airdrop contract
    const airdropContract = new ethers.Contract(AIRDROP_CONTRACT_ADDRESS, AIRDROP_ABI, wallet);

    // Estimate gas
    console.log('Estimating gas for airdrop...');
    let gasEstimate;
    try {
      gasEstimate = await airdropContract.airdrop.estimateGas(recipients, amountPerRecipient, {
        value: totalAmount
      });
      console.log('Estimated gas:', gasEstimate.toString());
    } catch (estimateError) {
      console.warn('Gas estimation failed (will proceed anyway):', estimateError.message);
      gasEstimate = null;
    }

    // Execute airdrop
    console.log('Executing airdrop transaction...');
    let tx;
    if (gasEstimate) {
      // Add 20% buffer to gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;
      tx = await airdropContract.airdrop(recipients, amountPerRecipient, {
        value: totalAmount,
        gasLimit
      });
    } else {
      tx = await airdropContract.airdrop(recipients, amountPerRecipient, {
        value: totalAmount
      });
    }

    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // Parse the AirdropExecuted event
    const contractInterface = new ethers.Interface(AIRDROP_ABI);
    let eventData = null;
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = contractInterface.parseLog(log);
        if (parsedLog && parsedLog.name === 'AirdropExecuted') {
          eventData = parsedLog.args;
          break;
        }
      } catch (e) {
        // Not the event we're looking for
      }
    }

    // Check contract balance after airdrop (should be 0 or minimal)
    const contractBalance = await airdropContract.getBalance();

    // Get final wallet balance
    const walletBalanceAfter = await provider.getBalance(wallet.address);
    const balanceUsed = walletBalance - walletBalanceAfter;

    return res.json({
      success: true,
      message: 'Airdrop executed successfully',
      airdrop: {
        from: wallet.address,
        recipientsCount: recipients.length,
        recipients: recipients,
        amountPerRecipient: amount,
        amountPerRecipientWei: amountPerRecipient.toString(),
        totalAmount: ethers.formatEther(totalAmount),
        totalAmountWei: totalAmount.toString()
      },
      transaction: {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        explorerUrl: monadExplorerTxUrl(receipt.hash)
      },
      balances: {
        walletBefore: ethers.formatEther(walletBalance),
        walletAfter: ethers.formatEther(walletBalanceAfter),
        balanceUsed: ethers.formatEther(balanceUsed),
        contractBalance: ethers.formatEther(contractBalance)
      },
      event: eventData ? {
        executor: eventData.executor,
        totalAmount: eventData.totalAmount.toString(),
        timestamp: new Date(Number(eventData.timestamp) * 1000).toISOString()
      } : null
    });

  } catch (error) {
    console.error('Airdrop error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

// Groq Compound (web-aware) for token price queries — same pattern as Somnia backend
let groqClient = null;
if (process.env.GROQ_API_KEY) {
  groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Keep this minimal. Long numbered “instructions” make groq/compound narrate step-by-step reasoning and tables instead of a short final answer.
const PRICE_SYSTEM_PROMPT = `You fetch live cryptocurrency prices from the web when needed.

Output rules (strict):
- Give only the final answer. Do not show step-by-step reasoning, numbered plans, chain-of-thought, or “how I searched.”
- Do not use large comparison tables unless the user explicitly asks for a table.
- Use a short format: a brief heading, then 1–3 lines with USD price, optional 24h change, and one named source (e.g. CoinMarketCap).
- If multiple coins were asked, list each in equally compact form.
- Be accurate; use current USD prices from reputable sources.`;

const COINGECKO_IDS = {
  bitcoin: 'bitcoin',
  btc: 'bitcoin',
  ethereum: 'ethereum',
  eth: 'ethereum',
  monad: 'monad',
  mon: 'monad',
  solana: 'solana',
  sol: 'solana',
};

async function fetchPriceFromCoinGecko(query) {
  const lower = query.toLowerCase();
  let coinId = null;
  for (const [keyword, id] of Object.entries(COINGECKO_IDS)) {
    if (lower.includes(keyword)) {
      coinId = id;
      break;
    }
  }
  if (!coinId) {
    return null;
  }

  const response = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price`,
    {
      params: {
        ids: coinId,
        vs_currencies: 'usd',
        include_24hr_change: true,
      },
      timeout: 15000,
    }
  );

  const data = response.data?.[coinId];
  if (!data?.usd) return null;

  const change = data.usd_24h_change;
  const changeText =
    typeof change === 'number'
      ? ` (${change >= 0 ? '+' : ''}${change.toFixed(2)}% 24h)`
      : '';

  return `${coinId.toUpperCase()} price: $${data.usd.toLocaleString()} USD${changeText}\nSource: CoinGecko`;
}

// Token price endpoint - fetch current token prices using natural language queries
app.post('/token-price', async (req, res) => {
  try {
    const { query } = req.body;

    // Validation
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: 'query is required and must be a non-empty string'
      });
    }

    if (query.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Query too long (max 500 characters)'
      });
    }

    console.log(`🔍 Processing price query: ${query}`);

    // Prefer CoinGecko for known assets — reliable and no tool-calling side effects.
    try {
      const coingeckoResponse = await fetchPriceFromCoinGecko(query);
      if (coingeckoResponse) {
        return res.json({
          success: true,
          query,
          response: coingeckoResponse,
          timestamp: new Date().toISOString(),
          model_used: 'coingecko',
        });
      }
    } catch (cgError) {
      console.warn('CoinGecko fallback failed:', cgError.message);
    }

    if (!groqClient) {
      return res.status(500).json({
        success: false,
        error: 'GROQ_API_KEY not configured. Please set it in your .env file'
      });
    }

    const completion = await groqClient.chat.completions.create({
      model: process.env.GROQ_PRICE_MODEL || 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: PRICE_SYSTEM_PROMPT },
        { role: 'user', content: query }
      ],
      temperature: 0.2,
    });

    const message = completion.choices[0].message;
    const responseText = message.content || '';

    console.log(`📄 Raw response from Groq:`, responseText.substring(0, 500));

    return res.json({
      success: true,
      query: query,
      response: responseText,
      timestamp: new Date().toISOString(),
      model_used: process.env.GROQ_PRICE_MODEL || 'openai/gpt-oss-120b',
      ...(Array.isArray(message.executed_tools) && message.executed_tools.length > 0
        ? { executed_tools: message.executed_tools }
        : {})
    });

  } catch (error) {
    console.error('Token price error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error fetching token prices',
      details: error.response?.data || error.code
    });
  }
});

// Wallet Analytics endpoint — Moralis API (Monad Testnet)
// https://docs.monad.xyz/guides/moralis-api
app.post('/api/balance/erc20', async (req, res) => {
  const { address } = req.body;

  try {
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: address',
      });
    }

    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
      });
    }

    const moralisApiKey = getMoralisApiKey();
    if (!moralisApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Moralis not configured. Set MORALIS_API_KEY in .env',
      });
    }

    console.log(`🔍 Fetching wallet portfolio for address: ${address}`);
    console.log(`📡 Using Moralis API (chain ${MONAD_MORALIS_CHAIN})`);

    const moralisUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens`;
    const response = await axios.get(moralisUrl, {
      params: { chain: MONAD_MORALIS_CHAIN },
      headers: {
        Accept: 'application/json',
        'X-API-Key': moralisApiKey,
      },
      timeout: 30000,
    });

    const tokens = response.data?.result || [];
    const formattedBalances = [];
    let nativeBalance = {
      balance: '0',
      balanceWei: '0',
      symbol: NATIVE_SYMBOL,
      name: 'Monad',
    };

    for (const token of tokens) {
      if (token.possible_spam) {
        continue;
      }

      const balanceFormatted = token.balance_formatted || '0';
      if (!balanceFormatted || parseFloat(balanceFormatted) === 0) {
        continue;
      }

      if (token.native_token) {
        nativeBalance = {
          balance: balanceFormatted,
          balanceWei: token.balance || '0',
          symbol: token.symbol || NATIVE_SYMBOL,
          name: token.name || 'Monad',
        };
        continue;
      }

      if (token.token_address) {
        formattedBalances.push({
          contractAddress: token.token_address,
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'UNKNOWN',
          balance: balanceFormatted,
          balanceWei: token.balance || '0',
          decimals: token.decimals ?? 18,
          priceUsd: token.usd_price ? Number(token.usd_price) : 0,
          valueUsd: token.usd_value ? Number(token.usd_value) : 0,
          logo: token.logo || null,
          verified: token.verified_contract || false,
        });
      }
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    if (nativeBalance.balance === '0') {
      const onChainBalance = await provider.getBalance(address);
      nativeBalance = {
        balance: ethers.formatEther(onChainBalance),
        balanceWei: onChainBalance.toString(),
        symbol: NATIVE_SYMBOL,
        name: 'Monad',
      };
    }

    const totalValueUsd = formattedBalances.reduce(
      (sum, token) => sum + (token.valueUsd || 0),
      0
    );

    return res.json({
      success: true,
      address,
      nativeBalance,
      tokenBalances: formattedBalances,
      totalTokens: formattedBalances.length,
      totalValueUsd,
      timestamp: new Date().toISOString(),
      provider: 'moralis',
      chain: MONAD_MORALIS_CHAIN,
    });
  } catch (error) {
    console.error('Wallet analytics error:', error);

    // Moralis lists Monad Mainnet (0x8f) but often rejects Monad Testnet (0x279f).
    // Fall back to RPC so get_balance / wallet_analytics still work on testnet.
    try {
      const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
      const onChainBalance = await provider.getBalance(address);
      const nativeBalance = {
        balance: ethers.formatEther(onChainBalance),
        balanceWei: onChainBalance.toString(),
        symbol: NATIVE_SYMBOL,
        name: 'Monad',
      };

      const ERC20_ABI = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)',
      ];

      const tokenBalances = [];
      try {
        const token = new ethers.Contract(WMON_ADDRESS, ERC20_ABI, provider);
        const [bal, decimals, symbol, name] = await Promise.all([
          token.balanceOf(address),
          token.decimals().catch(() => 18),
          token.symbol().catch(() => 'WMON'),
          token.name().catch(() => 'Wrapped MON'),
        ]);
        if (bal > 0n) {
          tokenBalances.push({
            contractAddress: WMON_ADDRESS,
            name,
            symbol,
            balance: ethers.formatUnits(bal, decimals),
            balanceWei: bal.toString(),
            decimals: Number(decimals),
            priceUsd: 0,
            valueUsd: 0,
            logo: null,
            verified: true,
          });
        }
      } catch {
        // ignore WMON read failures
      }

      return res.json({
        success: true,
        address,
        nativeBalance,
        tokenBalances,
        totalTokens: tokenBalances.length,
        totalValueUsd: 0,
        timestamp: new Date().toISOString(),
        provider: 'rpc-fallback',
        chain: MONAD_MORALIS_CHAIN,
        moralisError:
          error.response?.data?.message ||
          error.message ||
          'Moralis unavailable; used RPC fallback',
      });
    } catch (fallbackError) {
      console.error('RPC fallback failed:', fallbackError);
      if (error.response) {
        return res.status(error.response.status || 500).json({
          success: false,
          error: 'Error fetching wallet portfolio from Moralis API',
          apiResponse: error.response.data,
          status: error.response.status,
        });
      }
      return res.status(500).json({
        success: false,
        error: error.message || 'Error fetching wallet portfolio',
      });
    }
  }
});

// Yield Calculator endpoint - Create deposit and get yield projections
app.post('/yield', async (req, res) => {
  try {
    const { 
      privateKey, 
      tokenAddress, 
      depositAmount, 
      apyPercent 
    } = req.body;

    // Validation
    if (!privateKey || !tokenAddress || !depositAmount || !apyPercent) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: privateKey, tokenAddress, depositAmount, apyPercent'
      });
    }

    // Validate token address
    if (!ethers.isAddress(tokenAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token address format'
      });
    }

    // Validate APY (should be between 0 and 100)
    const apy = parseFloat(apyPercent);
    if (isNaN(apy) || apy <= 0 || apy > 100) {
      return res.status(400).json({
        success: false,
        error: 'APY must be a number between 0 and 100'
      });
    }

    // Validate deposit amount
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Deposit amount must be a positive number'
      });
    }

    // Use YieldCalculator contract address (from constant, fallback to env if needed)
    const yieldCalculatorAddress = YIELD_CALCULATOR_ADDRESS || process.env.YIELD_CALCULATOR_ADDRESS;
    if (!yieldCalculatorAddress) {
      return res.status(500).json({
        success: false,
        error: 'YIELD_CALCULATOR_ADDRESS not configured'
      });
    }

    const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    const tokenCode = await provider.getCode(tokenAddress);
    if (!tokenCode || tokenCode === '0x') {
      return res.status(400).json({
        success: false,
        error:
          'tokenAddress has no contract on Monad Testnet. Pass an ERC-20 that is deployed on this network (e.g. WMON or USDC test tokens).',
        tokenAddress
      });
    }

    // Initialize YieldCalculatorTool
    const tool = new YieldCalculatorTool(yieldCalculatorAddress, privateKey);

    // Step 1: Check token balance
    const { token, decimals } = await tool.initializeToken(tokenAddress);
    let tokenBalance;
    try {
      tokenBalance = await token.balanceOf(wallet.address);
    } catch (e) {
      if (e.code === 'BAD_DATA' || e.shortMessage?.includes('decode')) {
        return res.status(400).json({
          success: false,
          error:
            'tokenAddress is not a valid ERC-20 on this RPC (balanceOf failed). Use a standard ERC-20 deployed on Monad Testnet.',
          tokenAddress,
          detail: e.shortMessage || e.message
        });
      }
      throw e;
    }
    const tokenSymbol = await token.symbol().catch(() => 'TOKEN');
    const tokenName = await token.name().catch(() => 'Token');

    const requiredAmount = tool.parseToken(depositAmount, decimals);
    
    if (tokenBalance < requiredAmount) {
      const balanceFormatted = tool.formatToken(tokenBalance, decimals);
      return res.status(400).json({
        success: false,
        error: 'Insufficient token balance',
        tokenAddress: tokenAddress,
        tokenSymbol: tokenSymbol,
        currentBalance: balanceFormatted,
        requiredAmount: depositAmount
      });
    }

    // Step 2: Check and approve tokens if needed
    const allowance = await token.allowance(wallet.address, yieldCalculatorAddress);
    let approvalTxHash = null;

    if (allowance < requiredAmount) {
      console.log(`Approving tokens for YieldCalculator...`);
      const approveTx = await token.approve(yieldCalculatorAddress, ethers.MaxUint256);
      const approveReceipt = await approveTx.wait();
      approvalTxHash = approveReceipt.hash;
      console.log(`✅ Approval confirmed: ${approvalTxHash}`);
    }

    // Step 3: Create deposit
    const depositId = await tool.createDeposit(tokenAddress, depositAmount, apyPercent);

    // Step 4: Get current yield info
    const yieldInfo = await tool.getCurrentYield(parseInt(depositId));

    // Step 5: Calculate yield projections for specified periods
    const projectionPeriods = [7, 30, 60, 90, 180, 365]; // days
    const projections = [];

    for (const days of projectionPeriods) {
      const yieldAmount = await tool.calculateYield(parseInt(depositId), days);
      const yieldAmountNum = parseFloat(yieldAmount);
      const principalNum = parseFloat(yieldInfo.principal);
      const totalValue = (principalNum + yieldAmountNum).toFixed(6);

      projections.push({
        days: days,
        yieldAmount: yieldAmount,
        principal: yieldInfo.principal,
        totalValue: totalValue,
        tokenSymbol: yieldInfo.tokenSymbol
      });
    }

    // Get deposit transaction hash (from createDeposit)
    // Note: createDeposit returns depositId, but we can get tx info if needed
    // For now, we'll return the deposit info

    return res.json({
      success: true,
      message: 'Deposit created successfully',
      deposit: {
        depositId: depositId,
        tokenAddress: tokenAddress,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        depositAmount: depositAmount,
        apyPercent: apyPercent,
        principal: yieldInfo.principal,
        currentYield: yieldInfo.yieldAmount,
        totalAmount: yieldInfo.totalAmount,
        daysPassed: yieldInfo.daysPassed,
        active: yieldInfo.active
      },
      projections: projections,
      wallet: wallet.address,
      approvalTransaction: approvalTxHash ? {
        hash: approvalTxHash,
        explorerUrl: monadExplorerTxUrl(approvalTxHash)
      } : null,
      yieldCalculatorAddress: yieldCalculatorAddress,
      nextSteps: [
        `Your deposit is earning ${apyPercent}% APY`,
        `Use deposit ID ${depositId} to check yield or withdraw`,
        `Projections show total value (principal + yield) for each time period`
      ]
    });

  } catch (error) {
    console.error('Yield deposit error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.reason || error.code
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', network: 'Monad Testnet' });
});

async function fetchTokenPriceUsd(query) {
  const lower = String(query || '').toLowerCase();
  let coinId = null;
  for (const [keyword, id] of Object.entries(COINGECKO_IDS)) {
    if (lower.includes(keyword)) {
      coinId = id;
      break;
    }
  }
  if (!coinId) return { usd: 0 };
  const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
    params: { ids: coinId, vs_currencies: 'usd' },
    timeout: 15000,
  });
  const usd = response.data?.[coinId]?.usd || 0;
  return { usd, coinId };
}

async function getWalletAnalytics(address) {
  const moralisApiKey = getMoralisApiKey();
  const provider = new ethers.JsonRpcProvider(MONAD_TESTNET_RPC);
  const nativeWei = await provider.getBalance(address);
  const nativeBalance = {
    balance: ethers.formatEther(nativeWei),
    symbol: NATIVE_SYMBOL,
  };

  if (!moralisApiKey) {
    return { success: true, address, nativeBalance, tokens: [] };
  }

  const moralisUrl = `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens`;
  const response = await axios.get(moralisUrl, {
    params: { chain: MONAD_MORALIS_CHAIN },
    headers: { Accept: 'application/json', 'X-API-Key': moralisApiKey },
    timeout: 30000,
  });

  const tokens = (response.data?.result || [])
    .filter((t) => !t.possible_spam && parseFloat(t.balance_formatted || 0) > 0 && !t.native_token)
    .map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balance_formatted,
      tokenAddress: t.token_address,
    }));

  return { success: true, address, nativeBalance, tokens };
}

registerExtensionRoutes(app, { fetchTokenPriceUsd, getWalletAnalytics });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Network: Monad Testnet`);
});

module.exports = app;