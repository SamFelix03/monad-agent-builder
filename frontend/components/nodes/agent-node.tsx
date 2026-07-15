"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Bot } from "lucide-react"
import type { NodeData } from "@/lib/types"

export const AgentNode = memo(({ data, isConnectable }: NodeProps<NodeData>) => {
  return (
    <div 
      className="shadow-md rounded-md p-1 w-[120px] h-[120px]"
      style={{
        background: 'linear-gradient(to bottom right, var(--brand-gradient-from), var(--brand-gradient-to))',
      }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl bg-card">
        <Bot className="h-8 w-8 text-[var(--brand)]" />
        <div className="text-sm font-semibold text-foreground">Agent</div>
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3" />
      </div>
    </div>
  )
})

AgentNode.displayName = "AgentNode"

