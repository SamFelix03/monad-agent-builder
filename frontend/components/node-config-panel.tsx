"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { WorkflowNode } from "@/lib/types"

interface NodeConfigPanelProps {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: any) => void
  onClose: () => void
}

export default function NodeConfigPanel({ node, updateNodeData, onClose }: NodeConfigPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Configuration</p>
          <h2 className="text-base font-semibold tracking-tight">Tool Information</h2>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="tool-name">Tool Name</Label>
          <div className="surface-row p-3">
            <p className="text-sm font-medium">{node.data.label || node.type || "Unknown"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tool-id">Tool ID</Label>
          <div className="surface-row p-3">
            <p className="font-mono text-sm">{node.type || "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
