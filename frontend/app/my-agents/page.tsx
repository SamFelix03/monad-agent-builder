"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Bot, MessageCircle, Plus, Loader2, MoreVertical, Download, Copy, Check } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { getAgentsByUserId, deleteAgent } from "@/lib/agents"
import type { Agent } from "@/lib/supabase"
import { AppHeader } from "@/components/layout/app-header"
import { PageShell, PageContent } from "@/components/layout/page-shell"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function MyAgents() {
  const router = useRouter()
  const { ready, authenticated, user, logout, loading: authLoading } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [selectedAgentForExport, setSelectedAgentForExport] = useState<Agent | null>(null)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/")
    }
  }, [ready, authenticated, router])

  useEffect(() => {
    if (ready && authenticated && user?.id) {
      fetchAgents()
    }
  }, [ready, authenticated, user])

  const fetchAgents = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const userAgents = await getAgentsByUserId(user.id)
      setAgents(userAgents)
    } catch (error) {
      console.error("Error fetching agents:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    setAgentToDelete(agentId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!agentToDelete) return
    try {
      await deleteAgent(agentToDelete)
      setAgents(agents.filter((agent) => agent.id !== agentToDelete))
      setDeleteDialogOpen(false)
      setAgentToDelete(null)
    } catch (error) {
      console.error("Error deleting agent:", error)
    }
  }

  const handleAgentClick = (agentId: string) => {
    router.push(`/agent-builder?agent=${agentId}`)
  }

  if (!ready || authLoading) {
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
    <PageShell>
      <AppHeader
        walletModalOpen={walletModalOpen}
        onWalletModalOpenChange={setWalletModalOpen}
        onLogout={logout}
      />

      <main className="flex-1">
        <PageContent>
          <div className="animate-fade-in-up mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="page-title">
                <span className="text-brand-gradient">My Agents</span>
              </h1>
              <p className="page-subtitle mt-1.5">
                Manage and interact with your Monad agents
              </p>
            </div>
            <Button asChild size="lg" variant="brand" className="shrink-0 self-start sm:self-auto">
              <Link href="/agent-builder">
                <Plus className="mr-2 h-5 w-5" />
                Create New Agent
              </Link>
            </Button>
          </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : agents.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="card-interactive"
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--brand)_12%,transparent)]">
                        <Bot className="h-5 w-5 text-[var(--brand)]" />
                      </div>
                      <CardTitle className="truncate text-lg">{agent.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAgentClick(agent.id)
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteAgent(agent.id)
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="mt-3 line-clamp-2">
                    {agent.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    {agent.tools.length} tool(s) configured
                  </div>
                </CardContent>
                <CardFooter className="mt-2 border-t border-border/50 pt-5">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/agent/${agent.id}/chat`)
                    }}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat with Agent
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedAgentForExport(agent)
                      setExportDialogOpen(true)
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Agent
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="animate-fade-in-up flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]">
              <Bot className="h-8 w-8 text-[var(--brand)]" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight">No agents yet</h3>
            <p className="mb-8 mt-2 max-w-md text-muted-foreground">
              Create your first Monad agent to get started with workflow automation
            </p>
            <Button asChild size="lg" variant="brand">
              <Link href="/agent-builder">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Agent
              </Link>
            </Button>
          </div>
        )}
        </PageContent>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-primary text-primary-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="!w-[95vw] !max-w-[95vw] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <DialogHeader>
            <DialogTitle>Export Agent: {selectedAgentForExport?.name}</DialogTitle>
            <DialogDescription>
              Use this agent in your code with the API key below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">API Key</label>
              <div className="relative rounded-xl border border-border/60 bg-muted/40 p-4">
                <code className="break-all pr-10 font-mono text-sm">{selectedAgentForExport?.api_key}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => {
                    if (selectedAgentForExport?.api_key) {
                      navigator.clipboard.writeText(selectedAgentForExport.api_key)
                      setCopiedItem("api_key")
                      setTimeout(() => setCopiedItem(null), 2000)
                      toast({
                        title: "Copied",
                        description: "API key copied to clipboard",
                      })
                    }
                  }}
                >
                  {copiedItem === "api_key" ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">How to Use</label>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Make a POST request to <code className="bg-muted px-1 py-0.5 rounded">/api/agent/chat</code> with the following body:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code className="bg-muted px-1 py-0.5 rounded">api_key</code>: Your agent's API key (shown above)</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">user_message</code>: The message you want to send to the agent</li>
                </ul>
              </div>
            </div>

            {/* cURL Example */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">cURL Example</label>
              <div className="relative">
                <pre className="surface-row overflow-x-auto p-4 text-xs">
                  <code>{`curl -X POST https://monad-agent-builder.vercel.app/api/agent/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "${selectedAgentForExport?.api_key || 'YOUR_API_KEY'}",
    "user_message": "your_message_here"
  }'`}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const curlCommand = `curl -X POST https://monad-agent-builder.vercel.app/api/agent/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "${selectedAgentForExport?.api_key || 'YOUR_API_KEY'}",
    "user_message": "your_message_here"
  }'`
                    navigator.clipboard.writeText(curlCommand)
                    setCopiedItem("curl")
                    setTimeout(() => setCopiedItem(null), 2000)
                    toast({
                      title: "Copied",
                      description: "cURL command copied to clipboard",
                    })
                  }}
                >
                  {copiedItem === "curl" ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* JavaScript Example */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">JavaScript Example</label>
              <div className="relative">
                <pre className="surface-row overflow-x-auto p-4 text-xs">
                  <code>{`const response = await fetch('https://monad-agent-builder.vercel.app/api/agent/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    api_key: '${selectedAgentForExport?.api_key || 'YOUR_API_KEY'}',
    user_message: 'your_message_here'
  })
});

const data = await response.json();
console.log(data);`}</code>
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    const jsCode = `const response = await fetch('https://monad-agent-builder.vercel.app/api/agent/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    api_key: '${selectedAgentForExport?.api_key || 'YOUR_API_KEY'}',
    user_message: 'your_message_here'
  })
});

const data = await response.json();
console.log(data);`
                    navigator.clipboard.writeText(jsCode)
                    setCopiedItem("javascript")
                    setTimeout(() => setCopiedItem(null), 2000)
                    toast({
                      title: "Copied",
                      description: "JavaScript code copied to clipboard",
                    })
                  }}
                >
                  {copiedItem === "javascript" ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Response Format */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Response Format</label>
              <div className="surface-row p-4">
                <pre className="overflow-x-auto text-xs">
                  <code>{`{
  "agent_response": "The agent's response text...",
  "tool_calls": [
    {
      "tool": "tool_name",
      "parameters": { ... }
    }
  ],
  "results": [
    {
      "success": true,
      "tool": "tool_name",
      "result": { ... }
    }
  ]
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

