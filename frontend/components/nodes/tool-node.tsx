"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import type { NodeData } from "@/lib/types"
import { getToolLabel, getToolByName } from "@/lib/tool-registry"
import { getToolNodeColors, ToolIcon } from "@/lib/tool-ui"

const CATEGORY_SHORT: Record<string, string> = {
  chain_read: "Read",
  chain_write: "Write",
  trade_read: "Quote",
  trade_write: "Trade",
  commerce_read: "Browse",
  commerce_write: "Checkout",
}

export const ToolNode = memo(({ data, type, isConnectable }: NodeProps<NodeData>) => {
  const toolType = type || ""
  const meta = getToolByName(toolType)
  const colors = getToolNodeColors(toolType)
  const label = meta?.label ?? data.label ?? getToolLabel(toolType)
  const categoryShort = meta?.category ? CATEGORY_SHORT[meta.category] : null

  return (
    <div
      className={`card-shell min-w-[120px] max-w-[140px] border-2 bg-card/95 px-3 py-2 shadow-md ${colors.border}`}
    >
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.bg} ${colors.text}`}
        >
          <ToolIcon type={toolType} className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 w-full">
          <div className="truncate text-xs font-semibold leading-tight">{label}</div>
          {categoryShort && (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{categoryShort}</div>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="h-2.5 w-2.5" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="h-2.5 w-2.5" />
    </div>
  )
})

ToolNode.displayName = "ToolNode"
