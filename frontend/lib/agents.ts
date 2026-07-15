import { supabase, type Agent, type ToolConnection, type AgentPolicies, type AgentType } from './supabase'

export async function createAgent(
  userId: string,
  name: string,
  description: string | null,
  tools: ToolConnection[],
  options?: {
    agent_type?: AgentType
    policies?: AgentPolicies
    tool_configs?: Record<string, unknown>
  }
): Promise<Agent> {
  const apiKey = generateApiKey()

  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: userId,
      name,
      description,
      api_key: apiKey,
      tools,
      agent_type: options?.agent_type || 'general',
      policies: options?.policies || {},
      tool_configs: options?.tool_configs || {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`)
  }

  return data
}

export async function getAgentsByUserId(userId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`)
  }

  return data || []
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch agent: ${error.message}`)
  }

  return data
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key', apiKey)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch agent: ${error.message}`)
  }

  return data
}

export async function updateAgent(
  agentId: string,
  updates: {
    name?: string
    description?: string | null
    tools?: ToolConnection[]
    agent_type?: AgentType
    policies?: AgentPolicies
    tool_configs?: Record<string, unknown>
  }
): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`)
  }

  return data
}

export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await supabase.from('agents').delete().eq('id', agentId)

  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`)
  }
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
