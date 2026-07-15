"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import {
  ArrowRightLeft,
  RefreshCw,
  Wallet,
  Coins,
  Image as ImageIcon,
  Users,
  Gift,
  TrendingUp,
  PiggyBank,
  BarChart3,
} from "lucide-react"
import type { NodeData } from "@/lib/types"

const toolIcons: Record<string, React.ReactNode> = {
  transfer: <ArrowRightLeft className="h-4 w-4" />,
  swap: <RefreshCw className="h-4 w-4" />,
  get_balance: <Wallet className="h-4 w-4" />,
  deploy_erc20: <Coins className="h-4 w-4" />,
  deploy_erc721: <ImageIcon className="h-4 w-4" />,
  create_dao: <Users className="h-4 w-4" />,
  airdrop: <Gift className="h-4 w-4" />,
  fetch_price: <TrendingUp className="h-4 w-4" />,
  deposit_yield: <PiggyBank className="h-4 w-4" />,
  wallet_analytics: <BarChart3 className="h-4 w-4" />,
}

const toolColors: Record<string, { border: string; bg: string; text: string }> = {
  transfer: { border: "border-blue-500", bg: "bg-blue-100", text: "text-blue-500" },
  swap: { border: "border-purple-500", bg: "bg-purple-100", text: "text-purple-500" },
  get_balance: { border: "border-green-500", bg: "bg-green-100", text: "text-green-500" },
  deploy_erc20: { border: "border-yellow-500", bg: "bg-yellow-100", text: "text-yellow-500" },
  deploy_erc721: { border: "border-pink-500", bg: "bg-pink-100", text: "text-pink-500" },
  create_dao: { border: "border-indigo-500", bg: "bg-indigo-100", text: "text-indigo-500" },
  airdrop: { border: "border-cyan-500", bg: "bg-cyan-100", text: "text-cyan-500" },
  fetch_price: { border: "border-orange-500", bg: "bg-orange-100", text: "text-orange-500" },
  deposit_yield: { border: "border-emerald-500", bg: "bg-emerald-100", text: "text-emerald-500" },
  wallet_analytics: { border: "border-teal-500", bg: "bg-teal-100", text: "text-teal-500" },
}

export const ToolNode = memo(({ data, type, isConnectable }: NodeProps<NodeData>) => {
  const colors = toolColors[type || ""] || { border: "border-border", bg: "bg-muted", text: "text-muted-foreground" }
  const icon = toolIcons[type || ""] || null

  return (
    <div className={`card-shell min-w-[150px] border-2 bg-card/90 px-4 py-2.5 shadow-md ${colors.border}`}>
      <div className="flex items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colors.bg} ${colors.text}`}>
          {icon}
        </div>
        <div className="ml-2.5">
          <div className="text-sm font-semibold">{data.label || type}</div>
          <div className="text-xs text-muted-foreground">{data.description || "Tool"}</div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3" />
    </div>
  )
})

ToolNode.displayName = "ToolNode"

