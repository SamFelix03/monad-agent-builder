"use client"

import type { WorkflowNode } from "@/lib/types"
import NodeConfigPanel from "./node-config-panel"

interface NodeConfigFloatingPanelProps {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: unknown) => void
  onClose: () => void
}

export function NodeConfigFloatingPanel({
  node,
  updateNodeData,
  onClose,
}: NodeConfigFloatingPanelProps) {
  return (
    <aside
      className="pointer-events-none absolute inset-y-0 right-0 z-20 flex p-4"
      aria-label="Tool configuration"
    >
      <div className="floating-tool-panel pointer-events-auto flex min-h-0 w-80 max-h-full flex-col overflow-hidden">
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <NodeConfigPanel
            node={node}
            updateNodeData={updateNodeData}
            onClose={onClose}
          />
        </div>
      </div>
    </aside>
  )
}
