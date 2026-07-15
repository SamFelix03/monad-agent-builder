import { ethers } from 'ethers'
import { supabase } from './supabase'

/**
 * Create a new EVM wallet
 * @returns Object with address and private key
 */
export function createWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  }
}

/**
 * Get wallet address from private key
 * @param privateKey - The private key to derive address from
 * @returns The wallet address
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  try {
    const wallet = new ethers.Wallet(privateKey)
    return wallet.address
  } catch (error) {
    throw new Error('Invalid private key')
  }
}

/**
 * Validate private key format
 * @param privateKey - The private key to validate
 * @returns True if valid
 */
export function isValidPrivateKey(privateKey: string): boolean {
  try {
    // Remove 0x prefix if present
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
    
    // Check if it's a valid hex string and correct length (64 hex chars = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      return false
    }
    
    // Try to create a wallet from it
    const wallet = new ethers.Wallet(`0x${cleanKey}`)
    return !!wallet.address
  } catch {
    return false
  }
}

/**
 * Save wallet to user's Supabase record
 * @param userId - The user ID
 * @param walletAddress - The wallet address
 * @param privateKey - The private key
 */
export async function saveWalletToUser(
  userId: string,
  walletAddress: string,
  privateKey: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      wallet_address: walletAddress,
      private_key: privateKey,
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to save wallet: ${error.message}`)
  }
}

/**
 * Remove wallet from user's Supabase record
 * @param userId - The user ID
 */
export async function removeWalletFromUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      wallet_address: null,
      private_key: null,
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to remove wallet: ${error.message}`)
  }
}

/**
 * Fetch native MON balance (Monad Testnet)
 */
export async function getTokenBalances(address: string): Promise<{
  mon: string
}> {
  const MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz'

  try {
    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL)
    const balance = await provider.getBalance(address)
    const formattedBalance = ethers.formatEther(balance)
    const numericBalance = parseFloat(formattedBalance)
    const monBalance = numericBalance.toFixed(2)

    return {
      mon: monBalance,
    }
  } catch (error) {
    console.error('Error fetching MON balance:', error)
    return {
      mon: '0.00',
    }
  }
}

