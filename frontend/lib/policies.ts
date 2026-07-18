import type { AgentPolicies, ToolConnection } from './supabase'
import { getDefaultPolicies, getToolCategory, type AgentType } from './tool-registry'

export type PolicyFieldType = 'number' | 'boolean' | 'string_list'

export interface PolicyFieldDef {
  key: keyof AgentPolicies
  label: string
  type: PolicyFieldType
  placeholder?: string
}

const TRADING_FIELDS: PolicyFieldDef[] = [
  { key: 'max_trade_notional_usd', label: 'Max trade (USD)', type: 'number' },
  { key: 'daily_spend_budget_usd', label: 'Daily spend budget (USD)', type: 'number' },
  { key: 'approval_threshold_usd', label: 'Approval threshold (USD)', type: 'number' },
  { key: 'max_slippage_bps', label: 'Max slippage (bps)', type: 'number' },
  { key: 'cooldown_seconds', label: 'Swap cooldown (sec)', type: 'number' },
  { key: 'require_quote_before_swap', label: 'Require quote before swap', type: 'boolean' },
]

const SHOPPING_FIELDS: PolicyFieldDef[] = [
  { key: 'max_order_usd', label: 'Max order (USD)', type: 'number' },
  { key: 'daily_shopping_budget_usd', label: 'Daily shopping budget (USD)', type: 'number' },
  { key: 'require_approval_for_checkout', label: 'Require checkout approval', type: 'boolean' },
  { key: 'merchant_allowlist', label: 'Merchants (comma-separated)', type: 'string_list', placeholder: 'mock' },
]

const CHAIN_WRITE_FIELDS: PolicyFieldDef[] = [
  { key: 'read_only', label: 'Read-only (block writes)', type: 'boolean' },
]

const CATEGORY_FIELDS: Record<string, PolicyFieldDef[]> = {
  chain_read: [],
  chain_write: CHAIN_WRITE_FIELDS,
  trade_read: [{ key: 'read_only', label: 'Read-only', type: 'boolean' }],
  trade_write: [...TRADING_FIELDS, { key: 'read_only', label: 'Read-only', type: 'boolean' }],
  commerce_read: [
    { key: 'max_order_usd', label: 'Max browse budget (USD)', type: 'number' },
    { key: 'merchant_allowlist', label: 'Merchants (comma-separated)', type: 'string_list', placeholder: 'mock' },
  ],
  commerce_write: [...SHOPPING_FIELDS],
  general: [],
}

export function getPolicyFieldsForTool(toolType: string): PolicyFieldDef[] {
  const category = getToolCategory(toolType)
  return CATEGORY_FIELDS[category] || []
}

export function getDefaultPoliciesForTool(toolType: string): AgentPolicies {
  const category = getToolCategory(toolType)
  if (category.startsWith('trade')) return { ...getDefaultPolicies('trading') }
  if (category.startsWith('commerce')) return { ...getDefaultPolicies('shopping') }
  if (category === 'chain_write') return {}
  return {}
}

export function mergePolicyLayers(...layers: Array<AgentPolicies | undefined>): AgentPolicies {
  const result: AgentPolicies = {}
  for (const layer of layers) {
    if (!layer) continue
    Object.assign(result, layer)
  }
  return result
}

/** Strictest merge for aggregated agent-level view / fallback */
export function aggregatePolicies(policiesList: AgentPolicies[]): AgentPolicies {
  if (!policiesList.length) return {}

  const result: AgentPolicies = {}
  const numericMins: (keyof AgentPolicies)[] = [
    'max_trade_notional_usd',
    'daily_spend_budget_usd',
    'approval_threshold_usd',
    'max_slippage_bps',
    'max_order_usd',
    'daily_shopping_budget_usd',
    'cooldown_seconds',
  ]

  for (const key of numericMins) {
    const values = policiesList
      .map((p) => p[key])
      .filter((v): v is number => typeof v === 'number')
    if (values.length) result[key] = Math.min(...values) as never
  }

  if (policiesList.some((p) => p.read_only)) result.read_only = true
  if (policiesList.some((p) => p.require_quote_before_swap)) result.require_quote_before_swap = true
  if (policiesList.some((p) => p.require_approval_for_checkout)) result.require_approval_for_checkout = true

  const allowlists = policiesList
    .map((p) => p.merchant_allowlist)
    .filter((a): a is string[] => Array.isArray(a) && a.length > 0)
  if (allowlists.length) {
    result.merchant_allowlist = allowlists.reduce((acc, list) =>
      acc.filter((m) => list.includes(m))
    )
  }

  const tokenLists = policiesList
    .map((p) => p.allowed_tokens)
    .filter((a): a is string[] => Array.isArray(a) && a.length > 0)
  if (tokenLists.length) {
    result.allowed_tokens = tokenLists.reduce((acc, list) =>
      acc.filter((t) => list.includes(t))
    )
  }

  return result
}

export function inferAgentType(tools: string[]): AgentType {
  const trading = ['quote_swap', 'swap', 'get_portfolio', 'get_trade_history']
  const shopping = ['product_search', 'product_details', 'build_cart', 'checkout_quote', 'place_order']
  const hasTrading = tools.some((t) => trading.includes(t))
  const hasShopping = tools.some((t) => shopping.includes(t))
  if (hasTrading && hasShopping) return 'hybrid'
  if (hasTrading) return 'trading'
  if (hasShopping) return 'shopping'
  return 'general'
}

export function aggregateToolsPolicies(tools: ToolConnection[]): AgentPolicies {
  return aggregatePolicies(tools.map((t) => t.policies || {}))
}

export function getPoliciesForToolExecution(
  toolName: string,
  tools: ToolConnection[]
): AgentPolicies {
  const matching = tools.filter((t) => t.tool === toolName)
  if (!matching.length) return {}
  if (matching.length === 1) {
    return mergePolicyLayers(getDefaultPoliciesForTool(toolName), matching[0].policies)
  }
  return mergePolicyLayers(
    getDefaultPoliciesForTool(toolName),
    aggregatePolicies(matching.map((m) => m.policies || {}))
  )
}

export function getConfigForToolExecution(
  toolName: string,
  tools: ToolConnection[]
): Record<string, unknown> {
  const matching = tools.filter((t) => t.tool === toolName)
  return Object.assign({}, ...matching.map((m) => m.config || {}))
}

/** Union of merchant providers allowed across shopping tool nodes. */
export function getMerchantAllowlistFromTools(tools: ToolConnection[]): string[] {
  const shoppingTools = tools.filter((t) =>
    ['product_search', 'product_details', 'build_cart', 'checkout_quote', 'place_order'].includes(t.tool)
  )
  const lists = shoppingTools
    .map((t) => t.policies?.merchant_allowlist)
    .filter((a): a is string[] => Array.isArray(a) && a.length > 0)

  if (!lists.length) {
    const fromConfig = shoppingTools
      .map((t) => t.config?.provider as string | undefined)
      .filter((p): p is string => Boolean(p))
    return fromConfig.length ? [...new Set(fromConfig)] : ['mock']
  }

  return lists.reduce((acc, list) => acc.filter((m) => list.includes(m)))
}

export function agentHasShoppingTools(tools: ToolConnection[]): boolean {
  return tools.some((t) =>
    ['product_search', 'product_details', 'build_cart', 'checkout_quote', 'place_order'].includes(t.tool)
  )
}
