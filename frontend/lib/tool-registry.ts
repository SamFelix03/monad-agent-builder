import registry from '../../shared/tools/registry.json'

export type AgentType = 'general' | 'trading' | 'shopping' | 'hybrid'

export interface ToolRegistryEntry {
  id: string
  runtime_name: string
  workflow_builder_name: string
  label: string
  description: string
  category: string
  risk: string
}

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

const aliases = registry.aliases as Record<string, string>

export function resolveToolName(name: string): string {
  return aliases[name] || name
}

export function getWorkflowToolTypes(): string[] {
  return registry.tools.map((t) => t.workflow_builder_name)
}

export function getToolPalette(): Array<{
  type: string
  label: string
  description: string
  category: string
}> {
  return registry.tools.map((t) => ({
    type: t.workflow_builder_name,
    label: t.label,
    description: t.description,
    category: t.category,
  }))
}

export function getDefaultPolicies(agentType: AgentType): AgentPolicies {
  const defaults = registry.default_policies as Record<string, AgentPolicies | string>
  const val = defaults[agentType]
  if (!val) return {}
  if (typeof val === 'string') {
    return { ...(defaults[val] as AgentPolicies) }
  }
  return { ...val }
}

export function getTemplates(): Record<
  string,
  {
    label?: string
    description?: string
    agent_type: AgentType
    chain: Array<{ tool: string; policies?: AgentPolicies | string }>
  }
> {
  return registry.templates as Record<
    string,
    {
      label?: string
      description?: string
      agent_type: AgentType
      chain: Array<{ tool: string; policies?: AgentPolicies | string }>
    }
  >
}

export function isValidToolType(type: string): boolean {
  const resolved = resolveToolName(type)
  return registry.tools.some((t) => t.workflow_builder_name === resolved)
}

export function getToolByName(type: string): (typeof registry.tools)[number] | undefined {
  const resolved = resolveToolName(type)
  return registry.tools.find(
    (t) => t.workflow_builder_name === resolved || t.runtime_name === resolved || t.id === resolved
  )
}

export function getToolLabel(type: string): string {
  return getToolByName(type)?.label ?? formatToolName(type)
}

export function getToolDescription(type: string): string {
  return getToolByName(type)?.description ?? 'Workflow tool'
}

export function getToolCategory(type: string): string {
  return getToolByName(type)?.category ?? 'general'
}

export function getToolRisk(type: string): string {
  return getToolByName(type)?.risk ?? 'low'
}

export function toolRequiresWallet(type: string): boolean {
  const meta = getToolByName(type) as { requires_wallet?: boolean } | undefined
  return Boolean(meta?.requires_wallet)
}

export function agentRequiresWallet(toolNames: string[]): boolean {
  return toolNames.some((t) => toolRequiresWallet(t))
}

export function isCommerceTool(type: string): boolean {
  const cat = getToolCategory(type)
  return cat.startsWith('commerce')
}

export function formatToolName(type: string): string {
  return resolveToolName(type)
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const TRADING_POLICY_DEFAULTS = getDefaultPolicies('trading')
export const SHOPPING_POLICY_DEFAULTS = getDefaultPolicies('shopping')
