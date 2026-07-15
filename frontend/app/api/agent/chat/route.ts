import { NextResponse } from 'next/server'
import { getAgentByApiKey } from '@/lib/agents'
import { supabase } from '@/lib/supabase'
import { aggregateToolsPolicies, inferAgentType } from '@/lib/policies'

const EXTERNAL_AGENT_API_URL =
  process.env.AGENT_API_URL || 'http://localhost:8000/agent/chat'

export async function POST(request: Request) {
  try {
    const { api_key, user_message } = await request.json()

    if (!api_key || !user_message) {
      return NextResponse.json(
        { error: 'Missing api_key or user_message in request body' },
        { status: 400 }
      )
    }

    const agent = await getAgentByApiKey(api_key)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('private_key, wallet_address')
      .eq('id', agent.user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found or error fetching user' },
        { status: 404 }
      )
    }

    if (!user.private_key) {
      return NextResponse.json(
        { error: 'Agent owner has no private key configured. Please contact the agent owner.' },
        { status: 400 }
      )
    }

    const tools = agent.tools || []
    const toolNames = tools.map((t) => t.tool)
    const agentType = agent.agent_type || inferAgentType(toolNames)
    const aggregatedPolicies = aggregateToolsPolicies(tools)

    const requestBody = {
      tools,
      user_message,
      agent_id: agent.id,
      user_id: agent.user_id,
      wallet_address: user.wallet_address,
      agent_type: agentType,
      policies: agent.policies || aggregatedPolicies,
      tool_configs: agent.tool_configs || {},
    }

    const response = await fetch(EXTERNAL_AGENT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown external API error' }))
      console.error('External Agent API error:', response.status, errorData)
      return NextResponse.json(
        { error: errorData.detail || errorData.message || `External Agent API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error in agent chat API route:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
