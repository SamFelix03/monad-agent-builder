#!/usr/bin/env bash
# Deploy all factory contracts to Monad Testnet using Monad Foundry.
# Prerequisites: foundryup --network monad, funded deployer keystore, testnet MON from https://faucet.monad.xyz
set -euo pipefail

cd "$(dirname "$0")/.."
ACCOUNT="${MONAD_DEPLOYER_ACCOUNT:-monad-deployer}"

echo "Deploying to Monad Testnet (chain 10143)..."

deploy() {
  local contract_path="$1"
  local contract_name="$2"
  forge create "$contract_path:$contract_name" --account "$ACCOUNT" --broadcast
}

deploy "ERC-20/TokenFactory.sol" "TokenFactory"
deploy "ERC-721/NFTFactory.sol" "NFTFactory"
deploy "DAO/DAO.sol" "DAOFactory"
deploy "Air Drop/Airdrop.sol" "Airdrop"
deploy "Yield/YieldCalculator.sol" "YieldCalculator"

echo "Copy deployed addresses into backend/.env (TOKEN_FACTORY_ADDRESS, etc.)"
