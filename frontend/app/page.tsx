"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { useAuth } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { ready, authenticated, login, loading } = useAuth()

  if (!ready || loading) {
    return (
      <PageShell className="items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--brand)]" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell className="items-center justify-center">
      <div className="page-content flex w-full max-w-3xl flex-col items-center justify-center gap-10 px-4 text-center">
        <div className="animate-fade-in-up flex flex-col items-center gap-5">
          <Image
            src="/monad-logo.png"
            alt="Monad"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
            priority
          />
          <h1 className="flex flex-col items-center text-5xl font-semibold tracking-tight sm:text-6xl">
            <span className="text-brand-gradient">Monad</span>
            <span className="mt-2 block text-foreground">No-Code Agent Builder</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Build your own Monad agents with ease. Create powerful workflows and automate your tasks.
          </p>
        </div>

        <div className="animate-fade-in-up flex flex-col gap-4 sm:flex-row" style={{ animationDelay: "80ms" }}>
          {authenticated ? (
            <Button asChild size="lg" variant="brand">
              <Link href="/my-agents">View My Agents</Link>
            </Button>
          ) : (
            <Button onClick={login} size="lg" variant="brand">
              Get Started
            </Button>
          )}
        </div>

        {!authenticated && (
          <p className="animate-fade-in-up text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
            Connect with email, wallet, or social accounts
          </p>
        )}
      </div>
    </PageShell>
  )
}
