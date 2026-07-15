import type { Node } from 'reactflow'

export interface NodeData {
  label: string
  description?: string
  required?: boolean
  policies?: Record<string, unknown>
  config?: Record<string, unknown>
}

export type WorkflowNode = Node<NodeData>

export interface Workflow {
  nodes: WorkflowNode[]
  edges: unknown[]
}
