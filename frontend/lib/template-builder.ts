import type { Edge, Node } from 'reactflow'
import type { AgentPolicies } from './supabase'
import { getTemplates, getDefaultPolicies, type AgentType } from './tool-registry'
import { getDefaultPoliciesForTool, mergePolicyLayers } from './policies'
import { createNode, generateNodeId } from './workflow-utils'

const AGENT_NODE_ID = 'agent-node'

export interface TemplateChainStep {
  tool: string
  policies?: AgentPolicies | string
}

export function buildTemplateWorkflow(
  templateKey: string,
  agentNodeId: string = AGENT_NODE_ID
): { nodes: Node[]; edges: Edge[]; agentType: string; name: string; description: string } | null {
  const templates = getTemplates()
  const tpl = templates[templateKey]
  if (!tpl) return null

  const chain: TemplateChainStep[] = tpl.chain || []
  if (!chain.length) return null

  const nodes: Node[] = []
  const edges: Edge[] = []
  const nodeIds: string[] = []

  chain.forEach((step, index) => {
    const nodeId = generateNodeId(step.tool)
    nodeIds.push(nodeId)

    let stepPolicies: AgentPolicies = {}
    if (typeof step.policies === 'string') {
      stepPolicies = getDefaultPolicies(step.policies as AgentType)
    } else if (step.policies) {
      stepPolicies = step.policies
    } else {
      stepPolicies = getDefaultPoliciesForTool(step.tool)
    }

    const node = createNode({
      type: step.tool,
      id: nodeId,
      position: { x: 280, y: 80 + index * 120 },
    })
    node.data.policies = mergePolicyLayers(getDefaultPoliciesForTool(step.tool), stepPolicies)
    const provider =
      (typeof stepPolicies === 'object' && stepPolicies.merchant_allowlist?.[0]) ||
      getDefaultPoliciesForTool(step.tool).merchant_allowlist?.[0] ||
      'mock'
    node.data.config = { provider }
    nodes.push(node)

    if (index > 0) {
      edges.push({
        id: `edge-${nodeIds[index - 1]}-${nodeId}`,
        source: nodeIds[index - 1],
        target: nodeId,
        type: 'custom',
      })
    }
  })

  if (nodeIds.length > 0) {
    edges.unshift({
      id: `edge-${agentNodeId}-${nodeIds[0]}`,
      source: agentNodeId,
      target: nodeIds[0],
      type: 'custom',
    })
  }

  return {
    nodes,
    edges,
    agentType: tpl.agent_type,
    name: tpl.label || templateKey.replace(/_/g, ' '),
    description: tpl.description || '',
  }
}

export function listTemplateOptions(): Array<{ key: string; label: string; description: string }> {
  const templates = getTemplates()
  return Object.entries(templates).map(([key, tpl]) => ({
    key,
    label: tpl.label || key.replace(/_/g, ' '),
    description: tpl.description || '',
  }))
}
