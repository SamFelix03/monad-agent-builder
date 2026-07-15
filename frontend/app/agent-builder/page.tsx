"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, Suspense } from "react"
import { PageShell } from "@/components/layout/page-shell"
import WorkflowBuilder from "@/components/workflow-builder"
import { useAuth } from "@/lib/auth"
import { Loader2 } from "lucide-react"

function AgentBuilderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentId = searchParams.get("agent")
  const { ready, authenticated, loading } = useAuth()

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/")
    }
  }, [ready, authenticated, router])

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

  if (!authenticated) {
    return null // Will redirect
  }

  return (
    <main className="h-dvh overflow-hidden">
      <WorkflowBuilder agentId={agentId || undefined} />
    </main>
  )
}

export default function AgentBuilder() {
  return (
    <Suspense
      fallback={
        <PageShell className="items-center justify-center">
          <div className="text-center animate-fade-in-up">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--brand)]" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </PageShell>
      }
    >
      <AgentBuilderContent />
    </Suspense>
  )
}

