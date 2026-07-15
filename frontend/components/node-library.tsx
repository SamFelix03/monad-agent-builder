"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { getToolPalette } from "@/lib/tool-registry"
import { ToolIcon } from "@/lib/tool-ui"

const categoryLabels: Record<string, string> = {
  chain_read: "On-chain (read)",
  chain_write: "On-chain (write)",
  trade_read: "Trading (read)",
  trade_write: "Trading (write)",
  commerce_read: "Shopping (read)",
  commerce_write: "Shopping (write)",
  general: "General",
}

export default function NodeLibrary() {
  const palette = getToolPalette()
  const grouped = palette.reduce<Record<string, typeof palette>>((acc, tool) => {
    const cat = tool.category || "general"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tool)
    return acc
  }, {})

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, toolType: string) => {
    event.dataTransfer.setData("application/reactflow", toolType)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(grouped).map(([category, tools]) => (
        <div key={category} className="mb-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {categoryLabels[category] || category}
          </p>
          <div className="flex flex-col gap-2">
            {tools.map((tool) => (
              <Button
                key={tool.type}
                variant="outline"
                className="h-auto w-full items-start justify-start whitespace-normal rounded-xl border-border/60 bg-card/50 px-3 py-3 text-left transition-spring hover:border-[color-mix(in_oklch,var(--brand)_30%,var(--border))]"
                draggable={true}
                onDragStart={(e) => onDragStart(e, tool.type)}
              >
                <ToolIcon type={tool.type} className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <span className="font-semibold leading-snug">{tool.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{tool.description}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Drag and drop tools onto the canvas to build your workflow
      </div>
    </div>
  )
}
