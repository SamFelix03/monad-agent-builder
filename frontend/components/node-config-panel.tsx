"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkflowNode } from "@/lib/types"
import type { AgentPolicies } from "@/lib/supabase"
import {
  getToolLabel,
  getToolDescription,
  getToolCategory,
  getToolRisk,
  getToolByName,
} from "@/lib/tool-registry"
import { getPolicyFieldsForTool, getDefaultPoliciesForTool } from "@/lib/policies"
import { getToolNodeColors, ToolIcon } from "@/lib/tool-ui"

interface NodeConfigPanelProps {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<WorkflowNode["data"]>) => void
  onClose: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  chain_read: "On-chain (read)",
  chain_write: "On-chain (write)",
  trade_read: "Trading (read)",
  trade_write: "Trading (write)",
  commerce_read: "Shopping (read)",
  commerce_write: "Shopping (write)",
  general: "General",
}

export default function NodeConfigPanel({ node, updateNodeData, onClose }: NodeConfigPanelProps) {
  const toolType = node.type || ""
  const meta = getToolByName(toolType)
  const colors = getToolNodeColors(toolType)
  const label = meta?.label ?? node.data.label ?? getToolLabel(toolType)
  const description = meta?.description ?? getToolDescription(toolType)
  const category = getToolCategory(toolType)
  const risk = getToolRisk(toolType)
  const policyFields = getPolicyFieldsForTool(toolType)

  const policies: AgentPolicies = {
    ...getDefaultPoliciesForTool(toolType),
    ...(node.data.policies as AgentPolicies | undefined),
  }

  const setPolicy = (key: keyof AgentPolicies, value: unknown) => {
    updateNodeData(node.id, {
      policies: { ...policies, [key]: value },
    })
  }

  const resetPolicies = () => {
    updateNodeData(node.id, { policies: getDefaultPoliciesForTool(toolType) })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Configuration</p>
          <h2 className="text-base font-semibold tracking-tight">{label}</h2>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg} ${colors.text}`}>
            <ToolIcon type={toolType} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{label}</p>
            <p className="font-mono text-xs text-muted-foreground">{toolType}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <div className="surface-row p-3">
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{CATEGORY_LABELS[category] ?? category}</Badge>
          <Badge variant={risk === "high" ? "destructive" : risk === "medium" ? "secondary" : "outline"}>
            {risk} risk
          </Badge>
        </div>

        {policyFields.length > 0 && (
          <div className="space-y-3 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between">
              <Label>Guardrails (this node)</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetPolicies}>
                Reset defaults
              </Button>
            </div>
            <div className="space-y-3">
              {policyFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  {field.type === "boolean" ? (
                    <Select
                      value={String(policies[field.key] ?? false)}
                      onValueChange={(v) => setPolicy(field.key, v === "true")}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">No</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : field.type === "string_list" ? (
                    <Input
                      className="h-9"
                      placeholder={field.placeholder || "mock, amazon"}
                      value={(policies[field.key] as string[] | undefined)?.join(", ") || ""}
                      onChange={(e) => {
                        const list = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                        setPolicy(field.key, list.length ? list : undefined)
                      }}
                    />
                  ) : (
                    <Input
                      type="number"
                      className="h-9"
                      value={policies[field.key] != null ? String(policies[field.key]) : ""}
                      onChange={(e) =>
                        setPolicy(field.key, e.target.value ? Number(e.target.value) : undefined)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {policyFields.length === 0 && (
          <p className="text-xs text-muted-foreground">
            This read-only tool has no spend guardrails. Add write tools to configure limits.
          </p>
        )}
      </div>
    </div>
  )
}
