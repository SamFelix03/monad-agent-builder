"use client"

import NodeLibrary from "./node-library"
import { TemplateLibrarySection } from "./template-library-section"
import { TOOL_PANEL_CARD_WIDTH, TOOL_PANEL_OUTER_PADDING } from "@/lib/workflow-layout"

interface ToolLibraryPanelProps {
  activeTemplate?: string | null
  onSelectTemplate?: (templateKey: string) => void
  disabled?: boolean
}

export function ToolLibraryPanel({
  activeTemplate,
  onSelectTemplate,
  disabled,
}: ToolLibraryPanelProps) {
  return (
    <aside
      className="pointer-events-none absolute inset-y-0 left-0 z-20 flex"
      style={{ padding: TOOL_PANEL_OUTER_PADDING }}
      aria-label="Workflow tool library"
    >
      <div
        className="floating-tool-panel pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden"
        style={{ width: TOOL_PANEL_CARD_WIDTH }}
      >
        <div className="shrink-0 border-b border-border/50 px-4 py-3">
          <p className="section-label mb-0.5">Tools</p>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Workflow Library
          </h2>
        </div>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {onSelectTemplate && (
            <TemplateLibrarySection
              activeTemplate={activeTemplate}
              onSelectTemplate={onSelectTemplate}
              disabled={disabled}
            />
          )}
          <NodeLibrary />
        </div>
      </div>
    </aside>
  )
}
