# Monad No-Code Agent Builder

## Introduction

**Monad No-Code Agent Builder** is a no-code platform that enables users to build, deploy, and interact with AI-powered blockchain agents on the Monad Testnet. The platform provides a visual workflow builder interface where users can create sophisticated blockchain automation workflows without writing code.

The platform supports 10 blockchain tools including **token transfers, swaps, token/NFT deployment, DAO creation, airdrops, yield calculations, price fetching, and wallet analytics**. All tools interact with smart contracts deployed on the Monad Testnet.

## Resources

* **Pitch Deck** : [View Here]()
* **Demo Video** : [View Here]()
* **Live Demo** : [View Here]()
  
### Deployed Tool Contracts

All smart contracts are deployed on the Monad Testnet. View them on the Explorer:

Deploy contracts to Monad Testnet with Monad Foundry (`backend/scripts/deploy-monad.sh`), then set addresses in `backend/.env`.

| Contract | Address | Explorer |
|----------|---------|----------|
| **TokenFactory** | `0x26D215752f68bc2254186F9f6FF068b8C4BdFd37` | [View](https://testnet.monadvision.com/address/0x26D215752f68bc2254186F9f6FF068b8C4BdFd37) |
| **NFTFactory** | `0x3EA6D1c84481f89aac255a7ABC375fe761653cdA` | [View](https://testnet.monadvision.com/address/0x3EA6D1c84481f89aac255a7ABC375fe761653cdA) |
| **DAOFactory** | `0x1E491de1a08843079AAb4cFA516C717597344e50` | [View](https://testnet.monadvision.com/address/0x1E491de1a08843079AAb4cFA516C717597344e50) |
| **Airdrop** | `0x14d42947929F1ECf882aA6a07dd4279ADb49345d` | [View](https://testnet.monadvision.com/address/0x14d42947929F1ECf882aA6a07dd4279ADb49345d) |
| **YieldCalculator** | `0xC6Ffc4E56388fFa99EA18503a0Ea518e795ceCC8` | [View](https://testnet.monadvision.com/address/0xC6Ffc4E56388fFa99EA18503a0Ea518e795ceCC8) |

Deployment transactions:
- TokenFactory: [0xe024d541f33648c84f4de4310e85dab3c8f5e55a17c4c445ea4175eb7e8318b6](https://testnet.monadvision.com/tx/0xe024d541f33648c84f4de4310e85dab3c8f5e55a17c4c445ea4175eb7e8318b6)
- NFTFactory: [0x4cc43c1ca534fb3b2e2f16301df9490b0e4bd87b9d48016bffd072d5b0c52a7c](https://testnet.monadvision.com/tx/0x4cc43c1ca534fb3b2e2f16301df9490b0e4bd87b9d48016bffd072d5b0c52a7c)
- DAOFactory: [0xab341addb15bbac91c3205fe59153a948601f04c3512e84ecc04e4331e481e75](https://testnet.monadvision.com/tx/0xab341addb15bbac91c3205fe59153a948601f04c3512e84ecc04e4331e481e75)
- Airdrop: [0xe1a10d0edfd39e996ad0609a680beb00d48a1da7180d22d671ccc5035bb52eb6](https://testnet.monadvision.com/tx/0xe1a10d0edfd39e996ad0609a680beb00d48a1da7180d22d671ccc5035bb52eb6)
- YieldCalculator: [0xf5ddc9bd97983efe6ac3ef6f7882de4a7a794c94ec7f36cb262bd106948336d6](https://testnet.monadvision.com/tx/0xf5ddc9bd97983efe6ac3ef6f7882de4a7a794c94ec7f36cb262bd106948336d6)

---

## How to Use

Getting started with Monad No-Code Agent Builder is simple! Follow these steps:

1. **Visit** [https://monad-agent-builder.vercel.app](https://monad-agent-builder.vercel.app)
2. **Get Started** with just a Google sign in.
3. **Create an Agent Wallet** or Import your own wallet from private key.
   
  <img width="1470" height="920" alt="Screenshot 2026-04-07 at 1 20 42 AM" src="https://github.com/user-attachments/assets/0dd3ec35-16a9-4fd9-ad91-734c66ba446e" />

4. **Create Your First Agent** by just drag-dropping the tools you need!
   
  <img width="1470" height="920" alt="Screenshot 2026-04-07 at 1 21 59 AM" src="https://github.com/user-attachments/assets/3b519400-29be-4506-9387-e0c07cbfb318" />

5. **You Can Also AI Generate Your Agent!** just ask our AI to generate your agent with the right tools.
   
  <img width="1470" height="919" alt="510075316-6e660f4d-0c49-439b-87f8-ab8bce482a5c (1)" src="https://github.com/user-attachments/assets/3dcbe4d0-1b34-4872-bae5-9014568b1920" />

6. **Save your agent**.

  <img width="1470" height="919" alt="510075537-f877450d-9bd4-428b-8cbe-f35af87d4752" src="https://github.com/user-attachments/assets/4508e875-de3d-414c-9205-b2247b81eff5" />

7. **Interact with it** in the UI or with curl requests by using your api key.
   
   <img width="1470" height="918" alt="Screenshot 2025-11-05 at 7 11 58 PM" src="https://github.com/user-attachments/assets/bcba568e-381e-4f1b-bdf5-224b837d8b5b" />

  <img width="1470" height="920" alt="Screenshot 2026-04-07 at 1 27 19 AM" src="https://github.com/user-attachments/assets/0deb3a4c-1be4-4a29-8ac1-2c7f65895a75" />

That's it! You've created your first Monad agent without any programming knowledge, as simple as that!

---

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [System Components](#system-components)
   - [Frontend](#frontend)
   - [Backend API](#backend-api)
   - [Agent Service](#agent-service)
   - [Workflow Builder](#workflow-builder)
3. [Blockchain Tools](#blockchain-tools)
   - [Transfer Tool](#1-transfer-tool)
   - [Swap Tool](#2-swap-tool)
   - [Balance Fetch Tool](#3-balance-fetch-tool)
   - [ERC-20 Token Deployment](#4-erc-20-token-deployment)
   - [ERC-721 NFT Collection Deployment](#5-erc-721-nft-collection-deployment)
   - [DAO Creation](#6-dao-creation)
   - [Airdrop Tool](#7-airdrop-tool)
   - [Token Price Fetching](#8-token-price-fetching)
   - [Yield Calculator](#9-yield-calculator)
   - [Wallet Analytics](#10-wallet-analytics)
4. [Smart Contract Implementations](#smart-contract-implementations)
   - [TokenFactory & MyToken](#tokenfactory--mytoken)
   - [NFTFactory & MyNFT](#nftfactory--mynft)
   - [DAOFactory & DAO](#daofactory--dao)
   - [Airdrop Contract](#airdrop-contract)
   - [YieldCalculator Contract](#yieldcalculator-contract)

---

## Platform Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[Frontend - Next.js<br/>Visual Workflow Builder]
    end
    
    subgraph "AI Services Layer"
        Agent[Agent Service<br/>FastAPI<br/>AI Agent Orchestration]
        WBuilder[Workflow Builder<br/>FastAPI<br/>Natural Language Processing]
    end
    
    subgraph "API Layer"
        Backend[Backend API<br/>Express.js<br/>Blockchain Operations]
    end
    
    subgraph "Blockchain Layer - Monad Testnet"
        TokenFactory[TokenFactory Contract<br/>0x26D215752f68bc2254186F9f6FF068b8C4BdFd37]
        NFTFactory[NFTFactory Contract<br/>0x3EA6D1c84481f89aac255a7ABC375fe761653cdA]
        DAOFactory[DAOFactory Contract<br/>0x1E491de1a08843079AAb4cFA516C717597344e50]
        Airdrop[Airdrop Contract<br/>0x14d42947929F1ECf882aA6a07dd4279ADb49345d]
        YieldCalc[YieldCalculator Contract<br/>0xC6Ffc4E56388fFa99EA18503a0Ea518e795ceCC8]
        KuruFlow[Kuru Flow API<br/>Swap Aggregator]
        MoralisAPI[Moralis API<br/>Wallet Portfolio & Analytics]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI API<br/>GPT-4o / GPT-4o-search]
        IPFS[Pinata IPFS<br/>NFT Metadata Storage]
    end
    
    UI -->|HTTP Requests| Agent
    UI -->|HTTP Requests| WBuilder
    Agent -->|HTTP Requests| Backend
    WBuilder -->|HTTP Requests| Backend
    Backend -->|RPC Calls| TokenFactory
    Backend -->|RPC Calls| NFTFactory
    Backend -->|RPC Calls| DAOFactory
    Backend -->|RPC Calls| Airdrop
    Backend -->|RPC Calls| YieldCalc
    Backend -->|HTTP Requests| KuruFlow
    Backend -->|HTTP Requests| MoralisAPI
    Agent -->|API Calls| OpenAI
    Backend -->|API Calls| IPFS
    Backend -->|API Calls| OpenAI
```

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WorkflowBuilder
    participant Agent
    participant Backend
    participant Blockchain
    
    User->>Frontend: Describe workflow in natural language
    Frontend->>WorkflowBuilder: POST /create-workflow
    WorkflowBuilder->>OpenAI: Convert to workflow JSON
    OpenAI-->>WorkflowBuilder: Structured workflow
    WorkflowBuilder-->>Frontend: Workflow structure
    
    User->>Frontend: Connect tools visually
    Frontend->>Agent: POST /agent/chat (with tool connections)
    Agent->>OpenAI: Generate tool calls based on user message
    OpenAI-->>Agent: Tool calls with parameters
    
    loop For each tool call
        Agent->>Backend: Execute tool endpoint
        Backend->>Blockchain: Smart contract interaction
        Blockchain-->>Backend: Transaction receipt
        Backend-->>Agent: Tool result
    end
    
    Agent->>OpenAI: Summarize results
    OpenAI-->>Agent: Final response
    Agent-->>Frontend: Complete response with results
    Frontend-->>User: Display results
```

---

## System Components

### Frontend

**Technology Stack:**
- Next.js 15 (React 19)
- TypeScript
- React Flow (visual workflow builder)
- Tailwind CSS
- Radix UI components

**Key Features:**
- Visual drag-and-drop workflow builder
- Node-based tool configuration
- Real-time AI chat interface
- Workflow saving and loading
- Agent management dashboard

**Main Components:**
- `workflow-builder.tsx` - Main workflow canvas with React Flow
- `node-library.tsx` - Tool palette for dragging tools onto canvas
- `node-config-panel.tsx` - Configuration panel for selected nodes
- `ai-chat-modal.tsx` - Chat interface for interacting with agents
- Custom node types: Input, Output, Process, Conditional, Code

### Backend API

**Technology Stack:**
- Express.js
- ethers.js v6
- Solidity compiler (solc)
- Axios for HTTP requests
- OpenAI SDK

**Network:**
- Monad Testnet RPC: `https://testnet-rpc.monad.xyz`
- Explorer: `https://testnet.monadvision.com`

**Key Responsibilities:**
- Blockchain interaction via ethers.js
- Smart contract deployment and interaction
- Token/NFT/DAO creation via factory contracts
- IPFS metadata upload for NFTs
- Token price fetching via OpenAI search
- Wallet portfolio and analytics via Moralis API

**Port:** 3000 (default)

### Agent Service

**Technology Stack:**
- FastAPI
- OpenAI GPT-4o
- Python requests library

**Key Features:**
- Dynamic tool configuration based on workflow
- Sequential tool execution support
- Function calling with OpenAI
- Context-aware tool selection
- Private key management for transactions

**Endpoints:**
- `POST /agent/chat` - Main chat endpoint with tool execution
- `GET /tools` - List all available tools
- `GET /health` - Health check

**Port:** 8000 (default)

### Workflow Builder

**Technology Stack:**
- FastAPI
- OpenAI GPT-4o-2024-08-06 (structured outputs)

**Key Features:**
- Natural language to workflow conversion
- Structured JSON output with tool connections
- Sequential execution detection
- Tool type validation

**Endpoints:**
- `POST /create-workflow` - Convert natural language to workflow
- `GET /available-tools` - List available tools
- `GET /health` - Health check

**Port:** 8000 (default, different from agent service in production)

---

## Blockchain Tools

### 1. Transfer Tool

**Endpoint:** `POST /transfer`

**Description:**
Transfers native MON tokens or ERC-20 tokens from one wallet to another. Supports both native token transfers and ERC-20 token transfers.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "toAddress": "0x...",
  "amount": "0.01",
  "tokenAddress": "0x..." // Optional: if provided, transfers ERC-20 tokens
}
```

**Implementation Details:**

**For Native Token Transfer:**
1. Validates wallet balance
2. Creates transaction with `ethers.parseEther(amount)`
3. Sends transaction via `wallet.sendTransaction()`
4. Waits for confirmation
5. Returns transaction hash and explorer link

**For ERC-20 Token Transfer:**
1. Connects to token contract using ERC-20 ABI
2. Fetches token decimals
3. Parses amount with proper decimals: `ethers.parseUnits(amount, decimals)`
4. Checks token balance using `balanceOf()`
5. Calls `transfer()` function on token contract
6. Waits for transaction confirmation
7. Returns token info, transaction hash, and explorer link

**Response:**
```json
{
  "success": true,
  "type": "native" | "ERC20",
  "transactionHash": "0x...",
  "from": "0x...",
  "to": "0x...",
  "amount": "0.01",
  "blockNumber": 217915266,
  "gasUsed": "421000",
  "explorerUrl": "https://testnet.monadvision.com/tx/..."
}
```

**Contract Interaction:**
- Uses standard ERC-20 interface: `transfer(address to, uint256 amount)`
- No smart contract deployment needed (uses existing token contracts)

**Example:**
- [Token transfer transaction](https://testnet.monadvision.com/tx/0x0e2b455f1ae8df816541ca49925970ce3c9609ce6bf41e05cfb282f43d7a565c)

---

### 2. Swap Tool

**Endpoint:** `POST /swap`

**Description:**
Swaps one ERC-20 token for another using the Kuru Flow aggregator on Monad.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "10",
  "slippageTolerance": 3
}
```

**Implementation Details:**

1. **Quote from Kuru Flow:**
   - Authenticates with Kuru Flow API using the wallet address
   - Fetches optimal swap route and transaction calldata

2. **Token Approval (ERC-20 only):**
   - Skipped for native MON (`0x0000…0000`)
   - If insufficient allowance, calls `approve()` on the router returned by the quote

3. **Swap Execution:**
   - Sends transaction to Kuru Flow router with quoted calldata
   - Sets `value` when swapping native MON

4. **Transaction Confirmation:**
   - Waits for receipt and returns explorer link on Monad Testnet

**Response:**
```json
{
  "success": true,
  "wallet": "0x...",
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "10",
  "slippageTolerance": 3,
  "aggregator": "kuru-flow",
  "approveTxHash": "0x...",
  "swapTxHash": "0x...",
  "blockNumber": 218000000,
  "gasUsed": "150000",
  "explorerUrl": "https://testnet.monadvision.com/tx/..."
}
```

**Contract Interaction:**
- **Aggregator:** [Kuru Flow](https://docs.monad.xyz/guides/kuru-flow) — returns router address and calldata per quote

**Example:**
- [Swap transaction](https://testnet.monadvision.com/tx/0x9a301e8f76b157da39c2d74e7362cad4f2b0e1e00e4dbdd9d951f69218c6b3e7)

---

### 3. Balance Fetch Tool

**Endpoint:** `GET /balance/:address` or `GET /balance/:address/:token`

**Description:**
Fetches native MON balance or ERC-20 token balance for a wallet address.

**Implementation Details:**

**Native Balance:**
1. Uses `provider.getBalance(address)`
2. Formats using `ethers.formatEther()`
3. Returns balance in MON and wei

**ERC-20 Balance:**
1. Connects to token contract
2. Calls `balanceOf(address)`
3. Fetches `decimals()`, `symbol()`, `name()`
4. Formats balance using `ethers.formatUnits(balance, decimals)`
5. Returns token info and balance

**Response:**
```json
{
  "address": "0x...",
  "token": "0x...",
  "name": "Token Name",
  "symbol": "TKN",
  "balance": "1000.0",
  "balanceWei": "1000000000000000000000",
  "decimals": 18
}
```

**Contract Interaction:**
- Standard ERC-20 interface: `balanceOf(address)`, `decimals()`, `symbol()`, `name()`

---

### 4. ERC-20 Token Deployment

**Endpoint:** `POST /deploy-token`

**Description:**
Deploys a new ERC-20 token using the TokenFactory contract. Creates a customizable token with minting, burning, and pause capabilities.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "name": "SuperCoin",
  "symbol": "SUC",
  "initialSupply": "100000"
}
```

**Implementation Details:**

1. **Factory Contract Interaction:**
   - Factory Address: `0x26D215752f68bc2254186F9f6FF068b8C4BdFd37`
   - Calls `createToken(name, symbol, initialSupply)`
   - Estimates gas and adds 20% buffer
   - Sends transaction

2. **Event Parsing:**
   - Parses `TokenCreated` event from transaction receipt
   - Extracts new token address from event

3. **Token Transfer:**
   - Checks if creator is token owner
   - If owner, mints tokens to creator using `mint()` function
   - This increases total supply but ensures creator has tokens

4. **Token Info Retrieval:**
   - Calls factory `getTokenInfo(tokenAddress)`
   - Returns token metadata, creator, owner, supply info

**Response:**
```json
{
  "success": true,
  "message": "Token created successfully via TokenFactory",
  "contractAddress": "0x...",
  "tokenInfo": {
    "name": "SuperCoin",
    "symbol": "SUC",
    "initialSupply": "100000",
    "currentSupply": "200000.0",
    "creator": "0x...",
    "owner": "0x...",
    "deployedAt": "2025-11-04T09:53:46.000Z"
  },
  "transactionHash": "0x...",
  "explorerUrl": "https://testnet.monadvision.com/tx/..."
}
```

**Contract Interaction Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant TokenFactory
    participant MyToken
    
    User->>Backend: POST /deploy-token
    Backend->>TokenFactory: createToken(name, symbol, supply)
    TokenFactory->>MyToken: new MyToken(...)
    MyToken-->>TokenFactory: Token Address
    TokenFactory->>MyToken: transferOwnership(creator)
    TokenFactory-->>Backend: TokenCreated Event
    Backend->>MyToken: owner()
    Backend->>MyToken: mint(creator, supply)
    MyToken-->>Backend: Mint Confirmation
    Backend-->>User: Token Address & Info
```

**Example:**
- [Token minted transaction](https://testnet.monadvision.com/tx/0xe137b01956ee7c5de603964ec888269908fc9d9640a593329773f507ce8e6f21)

---

### 5. ERC-721 NFT Collection Deployment

**Endpoint:** `POST /create-nft-collection`

**Description:**
Creates a new ERC-721 NFT collection with automatic IPFS metadata upload and mints the first NFT.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "name": "Bat Collection",
  "symbol": "BAC"
}
```

**Implementation Details:**

1. **Metadata Generation:**
   - Creates JSON metadata for first NFT
   - Includes name, description, image, attributes
   - Uses placeholder image initially

2. **IPFS Upload:**
   - Uploads metadata to Pinata IPFS
   - Requires `PINATA_API_KEY` and `PINATA_SECRET_KEY`
   - Returns IPFS hash: `ipfs://QmXxx...`

3. **Base URI Creation:**
   - Creates IPFS directory structure
   - Uploads base directory metadata
   - Returns baseURI: `ipfs://QmXxx/`

4. **Collection Creation:**
   - Factory Address: `0x3EA6D1c84481f89aac255a7ABC375fe761653cdA`
   - Calls `createCollection(name, symbol, baseURI)`
   - Parses `CollectionCreated` event

5. **First NFT Minting:**
   - Connects to NFT collection contract
   - Calls `mintWithURI(creator, metadataURI)`
   - Returns token ID and metadata info

**Response:**
```json
{
  "success": true,
  "message": "NFT collection created and first NFT minted successfully",
  "collection": {
    "address": "0x...",
    "name": "Bat Collection",
    "symbol": "BAC",
    "baseURI": "ipfs://QmXxx/"
  },
  "firstNFT": {
    "tokenId": "1",
    "owner": "0x...",
    "metadataURI": "ipfs://QmXxx...",
    "metadata": {...}
  },
  "transactions": {
    "collectionCreation": "0x...",
    "minting": "0x..."
  }
}
```

**Contract Interaction Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant NFTFactory
    participant MyNFT
    participant Pinata
    
    User->>Backend: POST /create-nft-collection
    Backend->>Backend: Generate metadata JSON
    Backend->>Pinata: Upload metadata to IPFS
    Pinata-->>Backend: IPFS hash
    Backend->>Pinata: Create baseURI directory
    Pinata-->>Backend: Base URI
    Backend->>NFTFactory: createCollection(name, symbol, baseURI)
    NFTFactory->>MyNFT: new MyNFT(...)
    MyNFT-->>NFTFactory: Collection Address
    NFTFactory-->>Backend: CollectionCreated Event
    Backend->>MyNFT: mintWithURI(creator, metadataURI)
    MyNFT-->>Backend: Token ID
    Backend-->>User: Collection & NFT Info
```

**Example:**
- [NFT Collection transaction](https://testnet.monadvision.com/tx/0x2a899d692269d2301e7b159a8d2307eb76de37568f374ed8f0ec47f8c7187fc2)

---

### 6. DAO Creation

**Endpoint:** `POST /create-dao`

**Description:**
Creates a new Decentralized Autonomous Organization (DAO) with customizable voting period and quorum percentage.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "name": "My COOL DAO",
  "votingPeriod": "604800",
  "quorumPercentage": "51"
}
```

**Implementation Details:**

1. **Validation:**
   - Validates voting period > 0 (in seconds)
   - Validates quorum percentage (0-100)

2. **DAO Creation:**
   - Factory Address: `0x1E491de1a08843079AAb4cFA516C717597344e50`
   - Calls `createDAO(name, votingPeriod, quorumPercentage)`
   - Factory deploys new DAO contract
   - Creator is automatically added as first member with voting power 1

3. **DAO Info Retrieval:**
   - Connects to created DAO contract
   - Fetches: name, owner, memberCount, votingPeriod, quorumPercentage, proposalCount, totalVotingPower

**Response:**
```json
{
  "success": true,
  "message": "DAO created successfully via DAOFactory",
  "dao": {
    "address": "0x...",
    "name": "My COOL DAO",
    "owner": "0x...",
    "memberCount": "1",
    "votingPeriod": {
      "seconds": "604800",
      "days": "7.00"
    },
    "quorumPercentage": "51",
    "proposalCount": "0",
    "totalVotingPower": "1"
  },
  "transactionHash": "0x...",
  "explorerUrl": "https://testnet.monadvision.com/tx/..."
}
```

**Contract Interaction Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant DAOFactory
    participant DAO
    
    User->>Backend: POST /create-dao
    Backend->>DAOFactory: createDAO(name, period, quorum)
    DAOFactory->>DAO: new DAO(name, creator, period, quorum)
    DAO->>DAO: Add creator as member (votingPower=1)
    DAO-->>DAOFactory: DAO Address
    DAOFactory-->>Backend: DAOCreated Event
    Backend->>DAO: Get DAO info (name, members, etc.)
    DAO-->>Backend: DAO Information
    Backend-->>User: DAO Address & Info
```

**Example:**
- [Created DAO transaction](https://testnet.monadvision.com/tx/0x5a1763361f644c190af3613846f7ea3a03457ffe23d86133c5754c3bd5bff892)

---

### 7. Airdrop Tool

**Endpoint:** `POST /airdrop`

**Description:**
Batch transfers native MON tokens to multiple addresses in a single transaction using the Airdrop contract.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "recipients": ["0x...", "0x...", "0x..."],
  "amount": "0.01"
}
```

**Implementation Details:**

1. **Validation:**
   - Validates recipients array is non-empty
   - Validates all addresses are valid Ethereum addresses
   - Validates amount > 0

2. **Balance Check:**
   - Calculates total amount: `amount * recipients.length`
   - Checks wallet balance >= total amount

3. **Airdrop Execution:**
   - Contract Address: `0x14d42947929F1ECf882aA6a07dd4279ADb49345d`
   - Calls `airdrop(recipients, amountPerRecipient)`
   - Sends total amount as `msg.value`
   - Contract distributes tokens to all recipients

4. **Event Parsing:**
   - Parses `AirdropExecuted` event
   - Extracts executor, recipients, total amount, timestamp

**Response:**
```json
{
  "success": true,
  "message": "Airdrop executed successfully",
  "airdrop": {
    "from": "0x...",
    "recipientsCount": 3,
    "recipients": ["0x...", "0x...", "0x..."],
    "amountPerRecipient": "0.01",
    "totalAmount": "0.03"
  },
  "transaction": {
    "hash": "0x...",
    "blockNumber": 218174401,
    "gasUsed": "133488"
  },
  "event": {
    "executor": "0x...",
    "totalAmount": "30000000000000000",
    "timestamp": "2025-11-02T11:31:42.000Z"
  }
}
```

**Contract Interaction Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant AirdropContract
    participant Recipient1
    participant Recipient2
    participant Recipient3
    
    User->>Backend: POST /airdrop (3 recipients, 0.01 each)
    Backend->>Backend: Validate addresses & balance
    Backend->>AirdropContract: airdrop(recipients[], 0.01) + 0.03 MON
    AirdropContract->>Recipient1: transfer(0.01 MON)
    AirdropContract->>Recipient2: transfer(0.01 MON)
    AirdropContract->>Recipient3: transfer(0.01 MON)
    AirdropContract-->>Backend: AirdropExecuted Event
    Backend-->>User: Transaction hash & results
```

**Example:**
- [Airdrop transaction](https://testnet.monadvision.com/tx/0x6306bec4833af8ee205a4a9caee5b836908a89a1634021811c26678c5632b532)

---

### 8. Token Price Fetching

**Endpoint:** `POST /token-price`

**Description:**
Fetches current cryptocurrency prices with natural language queries.

**Request Body:**
```json
{
  "query": "bitcoin current price"
}
```

**Implementation Details:**

1. **Query Processing:**
   - System prompt instructs model to:
     - Parse natural language queries
     - Identify cryptocurrency symbols
     - Search for current prices
     - Return structured price information

**Response:**
```json
{
  "success": true,
  "query": "bitcoin current price",
  "response": "As of November 2, 2025, Bitcoin (BTC) is trading at approximately $110,957 USD...",
  "timestamp": "2025-11-02T12:24:30.862Z",
}
```

---

### 9. Yield Calculator

**Endpoint:** `POST /yield`

**Description:**
Creates a deposit with yield prediction using any ERC-20 token. Calculates yield based on APY and time period.

**Request Body:**
```json
{
  "privateKey": "0x...",
  "tokenAddress": "0x...",
  "depositAmount": "0.1",
  "apyPercent": 5
}
```

**Implementation Details:**

1. **Token Approval:**
   - Checks token balance
   - Checks allowance for YieldCalculator contract
   - Approves if needed: `approve(contractAddress, MaxUint256)`

2. **Deposit Creation:**
   - Contract Address: `0xC6Ffc4E56388fFa99EA18503a0Ea518e795ceCC8` (or from `YIELD_CALCULATOR_ADDRESS` env var)
   - Calls `createDeposit(tokenAddress, amount, apy)`
   - APY converted to basis points: `apyPercent * 100`
   - Tokens transferred from user to contract

3. **Yield Projections:**
   - Calculates yield for multiple periods: 7, 30, 60, 90, 180, 365 days
   - Uses formula: `amount * (apy / 10000) * (timeInSeconds / 31536000)`
   - Returns projections with total value (principal + yield)

**Response:**
```json
{
  "success": true,
  "message": "Deposit created successfully",
  "deposit": {
    "depositId": "2",
    "tokenAddress": "0x...",
    "tokenName": "SuperCoin",
    "tokenSymbol": "SUC",
    "depositAmount": "0.1",
    "apyPercent": 5,
    "principal": "0.1",
    "currentYield": "0.000000000158548959",
    "totalAmount": "0.100000000158548959",
    "daysPassed": "0.00",
    "active": true
  },
  "projections": [
    {
      "days": 7,
      "yieldAmount": "0.000095890410958904",
      "principal": "0.1",
      "totalValue": "0.100096",
      "tokenSymbol": "SUC"
    },
    ...
  ]
}
```

**Contract Interaction Diagram:**

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant TokenContract
    participant YieldCalculator
    
    User->>Backend: POST /yield
    Backend->>TokenContract: balanceOf(user)
    TokenContract-->>Backend: Balance
    Backend->>TokenContract: allowance(user, yieldContract)
    TokenContract-->>Backend: Allowance
    alt Insufficient Allowance
        Backend->>TokenContract: approve(yieldContract, MaxUint256)
        TokenContract-->>Backend: Approval Confirmed
    end
    Backend->>YieldCalculator: createDeposit(token, amount, apy)
    YieldCalculator->>TokenContract: transferFrom(user, contract, amount)
    TokenContract-->>YieldCalculator: Transfer Confirmed
    YieldCalculator-->>Backend: DepositCreated Event
    Backend->>YieldCalculator: calculateYield(depositId, days) [multiple times]
    YieldCalculator-->>Backend: Yield amounts
    Backend-->>User: Deposit ID & Projections
```

**Example:**
- [Yield transaction](https://testnet.monadvision.com/tx/0x469b9c79a4e67a7ac6507ed50d3b36a31090552610c21974ec1342cb877bbc3a)

---

### 10. Wallet Analytics

**Endpoint:** `POST /api/balance/erc20`

**Description:**
Fetches wallet portfolio including native MON balance and all ERC-20 token balances for a wallet address using Moralis API. Provides comprehensive wallet analytics with token prices and USD values.

**Request Body:**
```json
{
  "address": "0x..."
}
```

**Implementation Details:**

1. **Address Validation:**
   - Validates Ethereum address format using `ethers.isAddress()`
   - Returns error if address is invalid

2. **Moralis API Request:**
   - Endpoint: `https://deep-index.moralis.io/api/v2.2/wallets/{address}/tokens?chain=0x279f`
   - Authorization: `X-API-Key: {MORALIS_API_KEY}`

3. **Native Balance Fetching:**
   - Fetches native MON balance directly from blockchain using `provider.getBalance()`
   - Formats balance using `ethers.formatEther()`

4. **Response Processing:**
   - Parses Moralis token balance data
   - Filters out zero balances
   - Extracts token metadata: contract address, name, symbol, decimals, price (USD), value (USD)
   - Calculates total portfolio value in USD
   - Formats balances in both human-readable and wei formats

**Response:**
```json
{
  "success": true,
  "address": "0x...",
  "nativeBalance": {
    "balance": "1.5",
    "balanceWei": "1500000000000000000",
    "symbol": "MON",
    "name": "Monad"
  },
  "tokenBalances": [
    {
      "contractAddress": "0x...",
      "name": "Token Name",
      "symbol": "TKN",
      "balance": "1000.0",
      "balanceWei": "1000000000000000000000",
      "decimals": 18,
      "priceUsd": 0.5,
      "valueUsd": 500.0
    }
  ],
  "totalTokens": 1,
  "totalValueUsd": 500.0,
  "timestamp": "2025-11-02T12:00:00.000Z",
  "rawData": { ... }
}
```

**Environment Variables:**
- `MORALIS_API_KEY` (required): Moralis API key for wallet analytics on Monad Testnet (chain `0x279f`).

**Error Handling:**
- Returns 400 if address is missing or invalid
- Returns 400 if Moralis API returns errors
- Returns 500 if Moralis API is unreachable or request fails
- Includes detailed error messages and API response data in error responses

---

## Smart Contract Implementations

### TokenFactory & MyToken

**Location:** [`backend/ERC-20/`](https://github.com/SamFelix03/Monad-No-Code-Agent-Builder/tree/main/backend/ERC-20)

#### TokenFactory Contract

**Address:** `0x26D215752f68bc2254186F9f6FF068b8C4BdFd37`

**Key Functions:**
- `createToken(string name, string symbol, uint256 initialSupply)` - Deploys new MyToken contract
- `getTotalTokensDeployed()` - Returns total count
- `getTokensByCreator(address creator)` - Returns tokens created by address
- `getTokenInfo(address tokenAddress)` - Returns detailed token information

**Storage:**
- `deployedTokens[]` - Array of all deployed token addresses
- `creatorToTokens` - Mapping from creator to their tokens
- `tokenInfo` - Mapping from token address to TokenInfo struct

**Events:**
- `TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, uint256 initialSupply, uint256 timestamp)`

#### MyToken Contract

**Features:**
- ERC-20 standard implementation
- ERC20Burnable (tokens can be burned)
- ERC20Permit (gasless approvals)
- Ownable (owner-only functions)
- Pausable transfers (owner can pause)

**Key Functions:**
- `mint(address to, uint256 amount)` - Owner can mint new tokens
- `burn(uint256 amount)` - Anyone can burn their tokens
- `pause()` / `unpause()` - Owner can pause transfers
- `transfer()` / `transferFrom()` - Standard ERC-20 transfers (respects pause)

**Constructor:**
- Mints initial supply to deployer
- Sets deployer as owner
- Sets pause state to false

---

### NFTFactory & MyNFT

**Location:** [`backend/ERC-721/`](https://github.com/SamFelix03/Monad-No-Code-Agent-Builder/tree/main/backend/ERC-721)

#### NFTFactory Contract

**Address:** `0x3EA6D1c84481f89aac255a7ABC375fe761653cdA`

**Key Functions:**
- `createCollection(string name, string symbol, string baseURI)` - Deploys new MyNFT collection
- `getCollectionsByCreator(address creator)` - Returns collections by creator
- `getCollectionInfo(address collectionAddress)` - Returns collection details
- `getCollectionStats(address collectionAddress)` - Returns minting statistics

**Storage:**
- `deployedCollections[]` - Array of all collection addresses
- `creatorToCollections` - Mapping from creator to collections
- `collectionInfo` - Mapping from collection to CollectionInfo struct

**Events:**
- `CollectionCreated(address indexed collectionAddress, address indexed creator, string name, string symbol, string baseURI, uint256 timestamp)`

#### MyNFT Contract

**Features:**
- ERC-721 standard implementation
- ERC721URIStorage (custom token URIs)
- ERC721Burnable (tokens can be burned)
- Ownable (owner-only minting)
- Pausable transfers

**Key Functions:**
- `mint(address to)` - Owner mints NFT with baseURI + tokenId
- `mintWithURI(address to, string uri)` - Owner mints with custom URI
- `mintBatch(address to, uint256 amount)` - Batch minting (max 100)
- `setBaseURI(string baseURI)` - Owner updates base URI
- `setTokenURI(uint256 tokenId, string uri)` - Owner sets custom URI
- `pause()` / `unpause()` - Owner pauses transfers
- `tokensOfOwner(address owner)` - Returns all token IDs owned by address

**Token ID System:**
- Starts from 1
- Auto-increments with each mint
- `totalMinted()` returns count of minted tokens

---

### DAOFactory & DAO

**Location:** [`backend/DAO/`](https://github.com/SamFelix03/Monad-No-Code-Agent-Builder/tree/main/backend/DAO)

#### DAOFactory Contract

**Address:** `0x1E491de1a08843079AAb4cFA516C717597344e50`

**Key Functions:**
- `createDAO(string _name, uint256 _votingPeriod, uint256 _quorumPercentage)` - Deploys new DAO
- `getDAOCount()` - Returns total DAO count
- `getCreatorDAOs(address _creator)` - Returns DAOs created by address
- `getAllDAOs()` - Returns all DAO addresses

**Storage:**
- `allDAOs[]` - Array of all DAO addresses
- `creatorDAOs` - Mapping from creator to their DAOs

**Events:**
- `DAOCreated(address indexed daoAddress, string name, address indexed creator, uint256 votingPeriod, uint256 quorumPercentage, uint256 timestamp)`

#### DAO Contract

**Features:**
- Member management with voting power
- Proposal creation and voting
- Quorum-based execution
- Time-based voting periods

**Key Structures:**
```solidity
struct Member {
    bool isMember;
    uint256 votingPower;
    uint256 joinedAt;
}

struct Proposal {
    uint256 id;
    string description;
    address proposer;
    uint256 forVotes;
    uint256 againstVotes;
    uint256 startTime;
    uint256 endTime;
    bool executed;
    bool passed;
    mapping(address => bool) hasVoted;
}
```

**Key Functions:**
- `addMember(address _member, uint256 _votingPower)` - Only members can add members
- `removeMember(address _member)` - Remove member (not creator)
- `createProposal(string _description)` - Create new proposal
- `vote(uint256 _proposalId, bool _support)` - Vote on proposal
- `executeProposal(uint256 _proposalId)` - Execute proposal after voting period
- `getTotalVotingPower()` - Returns sum of all member voting powers

**Voting Logic:**
- Quorum: `(totalVotes * 100) >= (totalVotingPower * quorumPercentage)`
- Majority: `forVotes > againstVotes`
- Proposal passes if quorum met AND majority for

**Events:**
- `MemberAdded(address indexed member, uint256 votingPower)`
- `MemberRemoved(address indexed member)`
- `ProposalCreated(uint256 indexed proposalId, string description, address proposer)`
- `VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)`
- `ProposalExecuted(uint256 indexed proposalId, bool passed)`

---

### Airdrop Contract

**Location:** [`backend/Air Drop/Airdrop.sol`](https://github.com/SamFelix03/Monad-No-Code-Agent-Builder/blob/main/backend/Air%20Drop/Airdrop.sol)

**Address:** `0x14d42947929F1ECf882aA6a07dd4279ADb49345d`

**Features:**
- Gas-efficient batch transfers
- Native token (MON) distribution
- No contract storage needed (direct transfers)

**Key Functions:**
- `airdrop(address[] recipients, uint256 amount)` - Distribute same amount to all recipients
- `airdropWithAmounts(address[] recipients, uint256[] amounts)` - Distribute different amounts
- `getBalance()` - Returns contract balance (should be 0 after airdrop)
- `withdraw(address to)` - Owner emergency withdrawal

**Implementation:**
- Uses low-level `call{value: amount}("")` for gas efficiency
- Validates total amount matches `msg.value`
- Validates all recipients are non-zero addresses
- Emits `AirdropExecuted` event after completion

**Security:**
- Owner-only withdraw function
- Validates all inputs
- Reverts on transfer failures

---

### YieldCalculator Contract

**Location:** [`backend/Yield/YieldCalculator.sol`](https://github.com/SamFelix03/Monad-No-Code-Agent-Builder/blob/main/backend/Yield/YieldCalculator.sol)

**Address:** `0xC6Ffc4E56388fFa99EA18503a0Ea518e795ceCC8`

**Features:**
- Multi-token support (any ERC-20)
- APY-based yield calculation
- Time-based projections
- Deposit tracking per user

**Key Structures:**
```solidity
struct Deposit {
    address depositor;
    address tokenAddress;
    uint256 amount;
    uint256 apy; // Basis points (10000 = 100%)
    uint256 depositTime;
    bool active;
}
```

**Key Functions:**
- `createDeposit(address tokenAddress, uint256 amount, uint256 apy)` - Create new deposit
- `calculateYield(uint256 depositId, uint256 timeInSeconds)` - Calculate yield for time period
- `getCurrentYield(uint256 depositId)` - Get current accrued yield
- `getTotalAmount(uint256 depositId)` - Get principal + yield
- `withdraw(uint256 depositId)` - Withdraw deposit (principal + yield)
- `getUserDeposits(address user)` - Get all deposit IDs for user
- `getDepositInfo(uint256 depositId)` - Get deposit details

**Security:**
- Only depositor can withdraw their deposit
- Validates deposit is active
- Uses SafeERC20 for token transfers
- Checks contract balance before withdrawal

**Events:**
- `DepositCreated(address indexed depositor, uint256 depositId, address indexed tokenAddress, uint256 amount, uint256 apy)`
- `YieldCalculated(address indexed depositor, uint256 depositId, uint256 yieldAmount)`
- `Withdrawn(address indexed to, uint256 depositId, uint256 amount)`

---

## Architecture Diagrams

### Tool Execution Flow

```mermaid
graph LR
    A[User Request] --> B{Agent Service}
    B --> C[OpenAI Function Calling]
    C --> D{Tool Selection}
    D --> E[Backend API]
    E --> F{Contract Type}
    F --> G[Factory Contract]
    F --> H[Direct Contract]
    F --> I[External API]
    G --> J[New Contract Deployed]
    H --> K[Transaction Executed]
    I --> L[Data Retrieved]
    J --> M[Response to User]
    K --> M
    L --> M
```

### Contract Interaction Flow

```mermaid
graph TB
    subgraph "User Actions"
        U1[Deploy Token]
        U2[Deploy NFT]
        U3[Create DAO]
        U4[Airdrop]
        U5[Yield Deposit]
    end
    
    subgraph "Factory Contracts"
        F1[TokenFactory]
        F2[NFTFactory]
        F3[DAOFactory]
    end
    
    subgraph "Deployed Contracts"
        D1[MyToken]
        D2[MyNFT]
        D3[DAO]
    end
    
    subgraph "Utility Contracts"
        UU1[Airdrop]
        UU2[YieldCalculator]
    end
    
    U1 --> F1
    F1 --> D1
    U2 --> F2
    F2 --> D2
    U3 --> F3
    F3 --> D3
    U4 --> UU1
    U5 --> UU2
```

---

## License

MIT License

---

**Built for the Monad Testnet** 🌙
