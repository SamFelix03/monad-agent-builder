import type { Node, Edge } from 'reactflow'
import { createNode, generateNodeId } from './workflow-utils'
import { resolveToolName, isValidToolType, getToolLabel, getToolDescription } from './tool-registry'

interface AITool {
  id: string
  type: string
  name: string
  next_tools: string[]
}

interface AIResponse {
  agent_id: string
  tools: AITool[]
  has_sequential_execution: boolean
  description: string
  raw_response?: string
}

export function isValidAIWorkflowResponse(data: unknown): data is AIResponse {
  if (!data || typeof data !== 'object') return false
  const r = data as Partial<AIResponse>
  return Array.isArray(r.tools) && typeof r.description === 'string'
}

export function aiResponseToWorkflow(aiResponse: AIResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const toolIdToNodeId = new Map<string, string>()

  aiResponse.tools.forEach((tool, index) => {
    const ourToolType = resolveToolName(tool.type)

    if (!isValidToolType(ourToolType)) {
      console.warn(`Unknown tool type from AI: ${tool.type} (mapped to: ${ourToolType})`)
      return
    }

    const nodeId = generateNodeId(ourToolType)
    toolIdToNodeId.set(tool.id, nodeId)

    const row = Math.floor(index / 3)
    const col = index % 3
    const position = { x: col * 250 + 100, y: row * 150 + 100 }

    const node = createNode({
      id: nodeId,
      type: ourToolType,
      position,
    })
    node.data.label = tool.name || getToolLabel(ourToolType)
    node.data.description = getToolDescription(ourToolType)

    nodes.push(node)
  })

  aiResponse.tools.forEach((tool) => {
    const sourceNodeId = toolIdToNodeId.get(tool.id)
    if (!sourceNodeId) return

    tool.next_tools.forEach((nextToolId) => {
      const targetNodeId = toolIdToNodeId.get(nextToolId)
      if (targetNodeId) {
        edges.push({
          id: `edge-${sourceNodeId}-${targetNodeId}`,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'custom',
        })
      }
    })
  })

  return { nodes, edges }
}
