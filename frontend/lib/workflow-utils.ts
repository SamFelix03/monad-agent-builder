import type { Node, XYPosition } from 'reactflow'
import type { NodeData } from './types'
import { getToolByName, getToolDescription, getToolLabel } from './tool-registry'
import { getDefaultPoliciesForTool } from './policies'

const COMMERCE_TOOLS = new Set([
  'product_search',
  'product_details',
  'build_cart',
  'checkout_quote',
  'place_order',
])

let toolIdCounter = 0

export const generateNodeId = (type: string): string => {
  toolIdCounter++
  return `${type}-${toolIdCounter}`
}

export const createNode = ({
  type,
  position,
  id,
}: {
  type: string
  position: XYPosition
  id: string
}): Node<NodeData> => {
  return {
    id,
    type,
    position,
    data: {
      label: getDefaultLabel(type),
      description: getDefaultDescription(type),
      policies: getDefaultPoliciesForTool(type),
      config: COMMERCE_TOOLS.has(type)
        ? { provider: getDefaultPoliciesForTool(type).merchant_allowlist?.[0] || 'mock' }
        : {},
    },
  }
}

const getDefaultLabel = (type: string): string => getToolLabel(type)
const getDefaultDescription = (type: string): string => getToolDescription(type)

export function enrichNodeFromRegistry(node: Node<NodeData>): Node<NodeData> {
  if (!node.type || node.type === 'agent') return node
  const meta = getToolByName(node.type)
  if (!meta) return node
  return {
    ...node,
    data: {
      ...node.data,
      label: meta.label,
      description: meta.description,
      policies: node.data.policies ?? getDefaultPoliciesForTool(node.type),
    },
  }
}

export function enrichNodesFromRegistry(nodes: Node<NodeData>[]): Node<NodeData>[] {
  return nodes.map(enrichNodeFromRegistry)
}
