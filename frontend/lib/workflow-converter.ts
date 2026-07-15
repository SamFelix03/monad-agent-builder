import type { Node, Edge } from 'reactflow'
import type { AgentPolicies, ToolConnection } from './supabase'
import { generateNodeId, createNode } from './workflow-utils'
import { getDefaultPoliciesForTool, mergePolicyLayers } from './policies'

export type { ToolConnection }

/**
 * Convert canvas nodes/edges to DB tool connections (per-node policies included).
 */
export function workflowToTools(
  nodes: Node[],
  edges: Edge[],
  agentNodeId: string = 'agent-node'
): ToolConnection[] {
  const toolNodes = nodes.filter((node) => node.id !== agentNodeId && node.type !== 'agent')
  const toolEdges = edges.filter((edge) => edge.source !== agentNodeId && edge.target !== agentNodeId)

  const nodeIdToNode = new Map(toolNodes.map((n) => [n.id, n]))
  const nodeToNextNode = new Map<string, string>()
  toolEdges.forEach((edge) => nodeToNextNode.set(edge.source, edge.target))

  const nodesWithIncoming = new Set<string>()
  toolEdges.forEach((edge) => nodesWithIncoming.add(edge.target))

  const startingNodes = toolNodes.filter((node) => !nodesWithIncoming.has(node.id))
  const tools: ToolConnection[] = []
  const processedNodeIds = new Set<string>()

  const buildEntry = (nodeId: string, nextNodeId: string | undefined, nextTool: string | null): ToolConnection => {
    const node = nodeIdToNode.get(nodeId)!
    const toolType = node.type || ''
    const policies = (node.data?.policies as AgentPolicies | undefined) || {}
    const config = (node.data?.config as Record<string, unknown> | undefined) || {}
    return {
      node_id: nodeId,
      tool: toolType,
      next_tool: nextTool,
      next_node_id: nextNodeId || null,
      policies,
      config,
    }
  }

  const traverseChain = (nodeId: string): void => {
    if (processedNodeIds.has(nodeId)) return
    const node = nodeIdToNode.get(nodeId)
    if (!node?.type) return

    processedNodeIds.add(nodeId)
    const nextNodeId = nodeToNextNode.get(nodeId)

    if (nextNodeId) {
      const nextNode = nodeIdToNode.get(nextNodeId)
      const nextType = nextNode?.type || null
      tools.push(buildEntry(nodeId, nextNodeId, nextType))
      if (nextType) traverseChain(nextNodeId)
    } else {
      tools.push(buildEntry(nodeId, undefined, null))
    }
  }

  startingNodes.forEach((node) => traverseChain(node.id))

  toolNodes.forEach((node) => {
    if (!processedNodeIds.has(node.id) && node.type) {
      tools.push(buildEntry(node.id, undefined, null))
    }
  })

  return tools
}

/**
 * Restore canvas from saved tool connections (preserves node_id + per-node policies).
 */
export function toolsToWorkflow(
  tools: ToolConnection[],
  agentNodeId: string = 'agent-node'
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const toolToNodeId = new Map<string, string>()

  tools.forEach((toolData, index) => {
    const nodeId = toolData.node_id || generateNodeId(toolData.tool)
    toolToNodeId.set(`${toolData.tool}:${index}`, nodeId)

    const position = {
      x: 280,
      y: 80 + index * 120,
    }

    const node = createNode({ type: toolData.tool, position, id: nodeId })
    node.data.policies = toolData.policies || getDefaultPoliciesForTool(toolData.tool)
    node.data.config = toolData.config || {}
    nodes.push(node)
  })

  tools.forEach((toolData, index) => {
    if (!toolData.next_tool && !toolData.next_node_id) return
    const sourceNodeId = toolToNodeId.get(`${toolData.tool}:${index}`)
    let targetNodeId: string | null | undefined = toolData.next_node_id

    if (!targetNodeId) {
      const nextEntry = tools[index + 1]
      if (nextEntry?.tool === toolData.next_tool) {
        targetNodeId = toolToNodeId.get(`${nextEntry.tool}:${index + 1}`)
      } else {
        const targetIndex = tools.findIndex(
          (t, i) => i > index && t.tool === toolData.next_tool
        )
        targetNodeId =
          targetIndex >= 0 ? toolToNodeId.get(`${toolData.next_tool}:${targetIndex}`) : null
      }
    }

    if (sourceNodeId && targetNodeId) {
      edges.push({
        id: `edge-${sourceNodeId}-${targetNodeId}`,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'custom',
      })
    }
  })

  const nodesWithIncoming = new Set(edges.map((e) => e.target))
  nodes.forEach((node) => {
    if (!nodesWithIncoming.has(node.id)) {
      edges.push({
        id: `edge-${agentNodeId}-${node.id}`,
        source: agentNodeId,
        target: node.id,
        type: 'custom',
      })
    }
  })

  return { nodes, edges }
}
