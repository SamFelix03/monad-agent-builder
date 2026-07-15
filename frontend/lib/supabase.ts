import { createClient } from '@supabase/supabase-js'
import type { AgentType } from './tool-registry'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface AgentPolicies {
  max_trade_notional_usd?: number
  daily_spend_budget_usd?: number
  approval_threshold_usd?: number
  max_slippage_bps?: number
  allowed_tokens?: string[]
  require_quote_before_swap?: boolean
  max_order_usd?: number
  daily_shopping_budget_usd?: number
  merchant_allowlist?: string[]
  require_approval_for_checkout?: boolean
  read_only?: boolean
  cooldown_seconds?: number
}

export interface ToolConnection {
  node_id: string
  tool: string
  next_tool: string | null
  next_node_id?: string | null
  policies?: AgentPolicies
  config?: Record<string, unknown>
}

export interface User {
  id: string
  private_key: string | null
  wallet_address: string | null
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  user_id: string
  name: string
  description: string | null
  api_key: string
  tools: ToolConnection[]
  agent_type?: AgentType
  policies?: AgentPolicies
  tool_configs?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentApproval {
  id: string
  agent_id: string
  tool: string
  summary: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expires_at: string
  created_at: string
}

export interface AgentSession {
  id: string
  agent_id: string
  user_id: string
  budget_usd: number
  spent_usd: number
  merchant_allowlist: string[]
  expires_at: string
  status: string
}
