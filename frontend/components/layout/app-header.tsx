"use client"

import Image from "next/image"
import Link from "next/link"
import { LogOut } from "lucide-react"
import { AgentWalletModal } from "@/components/agent-wallet"

interface AppHeaderProps {
  walletModalOpen: boolean
  onWalletModalOpenChange: (open: boolean) => void
  onLogout: () => void
}

export function AppHeader({
  walletModalOpen,
  onWalletModalOpenChange,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="shrink-0 bg-transparent pt-3 md:pt-4">
      <div className="page-content flex h-14 items-center justify-between md:h-16">
        <Link
          href="/my-agents"
          className="flex shrink-0 items-center gap-2.5 transition-spring hover:scale-[1.02]"
        >
          <Image
            src="/monad-logo.png"
            alt="Monad"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-base font-semibold tracking-tight text-brand-gradient sm:text-lg">
            Agent Builder
          </span>
        </Link>

        <div className="nav-pill gap-1 px-1.5 py-1">
          <AgentWalletModal
            open={walletModalOpen}
            onOpenChange={onWalletModalOpenChange}
            variant="header"
          />
          <div className="nav-pill-separator" aria-hidden="true" />
          <button
            type="button"
            onClick={onLogout}
            title="Logout"
            className="nav-pill-btn"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
