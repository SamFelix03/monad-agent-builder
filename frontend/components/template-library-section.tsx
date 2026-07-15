"use client"

import { LayoutTemplate } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listTemplateOptions } from "@/lib/template-builder"
import { cn } from "@/lib/utils"

interface TemplateLibrarySectionProps {
  activeTemplate?: string | null
  onSelectTemplate: (templateKey: string) => void
  disabled?: boolean
}

export function TemplateLibrarySection({
  activeTemplate,
  onSelectTemplate,
  disabled,
}: TemplateLibrarySectionProps) {
  const templates = listTemplateOptions()

  return (
    <div className="mb-4 border-b border-border/50 pb-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Quick start
      </p>
      <div className="flex flex-col gap-2">
        {templates.map((tpl) => {
          const isActive = activeTemplate === tpl.key
          return (
            <Button
              key={tpl.key}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "h-auto w-full items-start justify-start whitespace-normal rounded-xl border-border/60 bg-card/50 px-3 py-2.5 text-left transition-spring hover:border-[color-mix(in_oklch,var(--brand)_30%,var(--border))]",
                isActive &&
                  "border-[color-mix(in_oklch,var(--brand)_40%,var(--border))] bg-[color-mix(in_oklch,var(--brand)_8%,var(--card))] shadow-sm",
              )}
              onClick={() => onSelectTemplate(tpl.key)}
            >
              <LayoutTemplate
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  isActive ? "text-[var(--brand)]" : "text-muted-foreground",
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="font-semibold leading-snug">{tpl.label}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{tpl.description}</span>
              </div>
            </Button>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Applies a pre-built tool chain to the canvas
      </p>
    </div>
  )
}
