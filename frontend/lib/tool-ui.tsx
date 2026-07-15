"use client"

import type { LucideIcon } from "lucide-react"
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
  Search,
  ShoppingCart,
  Package,
  CreditCard,
  LineChart,
  History,
  Wrench,
} from "lucide-react"
import { getToolCategory, resolveToolName } from "@/lib/tool-registry"

export const TOOL_ICONS: Record<string, LucideIcon> = {
  transfer: ArrowRightLeft,
  swap: RefreshCw,
  quote_swap: LineChart,
  get_portfolio: BarChart3,
  get_trade_history: History,
  get_balance: Wallet,
  deploy_erc20: Coins,
  deploy_erc721: ImageIcon,
  create_dao: Users,
  airdrop: Gift,
  fetch_price: TrendingUp,
  deposit_yield: PiggyBank,
  wallet_analytics: BarChart3,
  product_search: Search,
  product_details: Package,
  build_cart: ShoppingCart,
  checkout_quote: CreditCard,
  place_order: CreditCard,
}

export interface ToolNodeColors {
  border: string
  bg: string
  text: string
}

/** Per-tool accent (legacy tools keep distinct colors). */
const TOOL_COLORS: Record<string, ToolNodeColors> = {
  transfer: { border: "border-blue-500", bg: "bg-blue-100", text: "text-blue-600" },
  swap: { border: "border-purple-500", bg: "bg-purple-100", text: "text-purple-600" },
  quote_swap: { border: "border-violet-500", bg: "bg-violet-100", text: "text-violet-600" },
  get_portfolio: { border: "border-teal-500", bg: "bg-teal-100", text: "text-teal-600" },
  get_trade_history: { border: "border-slate-500", bg: "bg-slate-100", text: "text-slate-600" },
  get_balance: { border: "border-green-500", bg: "bg-green-100", text: "text-green-600" },
  deploy_erc20: { border: "border-yellow-500", bg: "bg-yellow-100", text: "text-yellow-700" },
  deploy_erc721: { border: "border-pink-500", bg: "bg-pink-100", text: "text-pink-600" },
  create_dao: { border: "border-indigo-500", bg: "bg-indigo-100", text: "text-indigo-600" },
  airdrop: { border: "border-cyan-500", bg: "bg-cyan-100", text: "text-cyan-600" },
  fetch_price: { border: "border-orange-500", bg: "bg-orange-100", text: "text-orange-600" },
  deposit_yield: { border: "border-emerald-500", bg: "bg-emerald-100", text: "text-emerald-600" },
  wallet_analytics: { border: "border-teal-500", bg: "bg-teal-100", text: "text-teal-600" },
  product_search: { border: "border-sky-500", bg: "bg-sky-100", text: "text-sky-600" },
  product_details: { border: "border-sky-400", bg: "bg-sky-50", text: "text-sky-600" },
  build_cart: { border: "border-amber-500", bg: "bg-amber-100", text: "text-amber-700" },
  checkout_quote: { border: "border-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
  place_order: { border: "border-rose-500", bg: "bg-rose-100", text: "text-rose-600" },
}

const CATEGORY_COLORS: Record<string, ToolNodeColors> = {
  chain_read: { border: "border-green-500/70", bg: "bg-green-100", text: "text-green-600" },
  chain_write: { border: "border-blue-500/70", bg: "bg-blue-100", text: "text-blue-600" },
  trade_read: { border: "border-violet-500/70", bg: "bg-violet-100", text: "text-violet-600" },
  trade_write: { border: "border-purple-500/70", bg: "bg-purple-100", text: "text-purple-600" },
  commerce_read: { border: "border-sky-500/70", bg: "bg-sky-100", text: "text-sky-600" },
  commerce_write: { border: "border-amber-500/70", bg: "bg-amber-100", text: "text-amber-700" },
  general: { border: "border-border", bg: "bg-muted", text: "text-muted-foreground" },
}

const DEFAULT_COLORS: ToolNodeColors = {
  border: "border-[color-mix(in_oklch,var(--brand)_40%,var(--border))]",
  bg: "bg-[color-mix(in_oklch,var(--brand)_12%,transparent)]",
  text: "text-[var(--brand)]",
}

export function getToolIcon(type: string): LucideIcon {
  const resolved = resolveToolName(type)
  return TOOL_ICONS[resolved] ?? Wrench
}

export function getToolNodeColors(type: string): ToolNodeColors {
  const resolved = resolveToolName(type)
  if (TOOL_COLORS[resolved]) return TOOL_COLORS[resolved]
  const category = getToolCategory(resolved)
  return CATEGORY_COLORS[category] ?? DEFAULT_COLORS
}

interface ToolIconProps {
  type: string
  className?: string
}

export function ToolIcon({ type, className = "h-4 w-4" }: ToolIconProps) {
  const Icon = getToolIcon(type)
  return <Icon className={className} />
}
