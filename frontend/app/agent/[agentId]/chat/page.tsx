"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Send, Bot, User, Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { getAgentById } from "@/lib/agents"
import type { Agent } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { formatToolName } from "@/lib/tool-registry"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  agentResponse?: AgentChatResponse
}

interface AgentChatResponse {
  agent_response: string
  tool_calls: Array<{
    tool: string
    parameters: Record<string, any>
  }>
  results: Array<{
    success: boolean
    tool: string
    result: any
    policy_decision?: string
    approval?: { id: string; summary?: string }
    summary?: string
    message?: string
  }>
  pending_approvals?: Array<{
    approval?: { id: string }
    summary?: string
    tool?: string
  }>
}

export default function AgentChatPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const agentId = params.agentId as string
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [resolvingApproval, setResolvingApproval] = useState<string | null>(null)
  const [sessionBudget, setSessionBudget] = useState("50")
  const [creatingSession, setCreatingSession] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load agent on mount
  useEffect(() => {
    const loadAgent = async () => {
      if (!agentId) {
        router.push("/my-agents")
        return
      }

      try {
        const agentData = await getAgentById(agentId)
        if (!agentData) {
          toast({
            title: "Agent not found",
            description: "The agent you're looking for doesn't exist",
            variant: "destructive",
          })
          router.push("/my-agents")
          return
        }
        setAgent(agentData)
      } catch (error: any) {
        console.error("Error loading agent:", error)
        toast({
          title: "Error",
          description: "Failed to load agent",
          variant: "destructive",
        })
        router.push("/my-agents")
      } finally {
        setLoadingAgent(false)
      }
    }

    loadAgent()
  }, [agentId, router])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus textarea when page loads
  useEffect(() => {
    if (!loadingAgent && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [loadingAgent])

  const handleCreateShoppingSession = async () => {
    if (!agent || !user?.id) return
    setCreatingSession(true)
    try {
      const response = await fetch(`/api/agent/sessions/${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          budgetUsd: Number(sessionBudget) || 50,
          merchantAllowlist: ["mock"],
          expiresInHours: 24,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create session")
      toast({
        title: "Shopping session created",
        description: `Budget: $${sessionBudget} for 24 hours`,
      })
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create session",
        variant: "destructive",
      })
    } finally {
      setCreatingSession(false)
    }
  }

  const handleResolveApproval = async (approvalId: string, status: "approved" | "rejected") => {
    setResolvingApproval(approvalId)
    try {
      const response = await fetch(`/api/agent/approvals/${approvalId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolvedBy: "user" }),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to resolve approval")
      }
      toast({
        title: status === "approved" ? "Approved" : "Rejected",
        description:
          status === "approved"
            ? "You can ask the agent to retry the action with the approvalId."
            : "Action was rejected.",
      })
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve approval",
        variant: "destructive",
      })
    } finally {
      setResolvingApproval(null)
    }
  }

  const renderPendingApprovals = (response: AgentChatResponse) => {
    const pending = response.pending_approvals || []
    const fromResults = response.results
      .filter((r) => r.policy_decision === "pending_approval")
      .map((r) => ({
        approval: r.approval,
        summary: r.summary || r.message,
        tool: r.tool,
      }))
    const all = [...pending, ...fromResults]
    if (all.length === 0) return null

    return (
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400">Pending Approval</h4>
        {all.map((item, idx) => {
          const approvalId = item.approval?.id
          if (!approvalId) return null
          return (
            <Card key={`${approvalId}-${idx}`} className="border-amber-500/40 shadow-none">
              <CardContent className="space-y-3 pt-4">
                <p className="text-sm">{item.summary || "This action requires your approval."}</p>
                {item.tool && (
                  <Badge variant="outline">{formatToolName(item.tool)}</Badge>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="brand"
                    disabled={resolvingApproval === approvalId}
                    onClick={() => handleResolveApproval(approvalId, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolvingApproval === approvalId}
                    onClick={() => handleResolveApproval(approvalId, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  After approving, tell the agent: &quot;Proceed with approvalId {approvalId}&quot;
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading || !agent || !agent.api_key) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    const userQuery = input.trim()
    setInput("")
    setIsLoading(true)

    try {
      if (!agent.api_key) {
        throw new Error("Agent API key not found")
      }

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: agent.api_key,
          user_message: userQuery,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      const data: AgentChatResponse = await response.json()

      // Remove privateKey/private_key fields from the response
      const cleanedData = removePrivateKeys(data) as AgentChatResponse

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: cleanedData.agent_response || "Response received",
        timestamp: new Date(),
        agentResponse: cleanedData,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error.message || "Failed to get response from agent"}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      toast({
        title: "Error",
        description: error.message || "Failed to chat with agent",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Recursively remove privateKey/private_key fields from objects
  const removePrivateKeys = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(removePrivateKeys)
    }

    if (typeof obj === "object") {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Skip privateKey and private_key fields
        if (key === "privateKey" || key === "private_key") {
          continue
        }
        cleaned[key] = removePrivateKeys(value)
      }
      return cleaned
    }

    return obj
  }


  const renderToolResult = (result: any, tool: string) => {
    if (!result?.result) return null

    const res = result.result
    const isSuccess = result.success && res.success

    return (
      <Card key={`${tool}-${result.success}`} className={cn("mb-3 shadow-none", !isSuccess && "border-destructive/50")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {isSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              {formatToolName(tool)}
            </CardTitle>
            <Badge variant={isSuccess ? "default" : "destructive"}>
              {isSuccess ? "Success" : "Failed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {res.message && (
            <p className="text-sm text-muted-foreground">{res.message}</p>
          )}

          {/* Airdrop Result */}
          {tool === "airdrop" && res.airdrop && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">From:</span>
                  <p className="font-mono text-xs">{res.airdrop.from}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipients:</span>
                  <p>{res.airdrop.recipientsCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount per recipient:</span>
                  <p>{res.airdrop.amountPerRecipient}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total amount:</span>
                  <p>{res.airdrop.totalAmount}</p>
                </div>
              </div>
              {res.airdrop.recipients && res.airdrop.recipients.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm">Recipients:</span>
                  <div className="mt-1 space-y-1">
                    {res.airdrop.recipients.map((addr: string, idx: number) => (
                      <p key={idx} className="surface-row p-2.5 font-mono text-xs">
                        {addr}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deposit Yield Result */}
          {tool === "deposit_yield" && res.deposit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Deposit ID:</span>
                  <p className="font-semibold">{res.deposit.depositId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Token:</span>
                  <p>{res.deposit.tokenSymbol} ({res.deposit.tokenName})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p>{res.deposit.depositAmount} {res.deposit.tokenSymbol}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">APY:</span>
                  <p>{res.deposit.apyPercent}%</p>
                </div>
              </div>
              {res.projections && res.projections.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm mb-2 block">Projections:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {res.projections.map((proj: any, idx: number) => (
                      <div key={idx} className="surface-row p-2.5">
                        <div className="font-semibold">{proj.days} Days</div>
                        <div className="text-muted-foreground">Total: {proj.totalValue} {proj.tokenSymbol}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Info */}
          {res.transaction && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-xs">Transaction:</span>
                  <p className="font-mono text-xs">{res.transaction.hash}</p>
                </div>
                {res.transaction.explorerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => window.open(res.transaction.explorerUrl, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
              {res.transaction.gasUsed && (
                <p className="text-xs text-muted-foreground mt-1">
                  Gas Used: {res.transaction.gasUsed}
                </p>
              )}
            </div>
          )}

          {/* Balances */}
          {res.balances && (
            <div className="pt-2 border-t">
              <span className="text-muted-foreground text-xs">Balances:</span>
              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div>
                  <span className="text-muted-foreground">Before:</span>
                  <p>{res.balances.walletBefore}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">After:</span>
                  <p>{res.balances.walletAfter}</p>
                </div>
              </div>
            </div>
          )}

          {/* Generic Result Data */}
          {!res.airdrop && !res.deposit && !res.transaction && (
            <div className="text-xs">
              <pre className="surface-row overflow-x-auto p-3 text-xs">
                {JSON.stringify(res, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loadingAgent) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
      </div>
    )
  }

  if (!agent) {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="glass-bar flex items-center justify-between px-[var(--page-gutter)] py-3">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/my-agents")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="chat-avatar chat-avatar-assistant h-9 w-9">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="section-label">Agent Chat</p>
              <h1 className="text-lg font-semibold tracking-tight">{agent.name}</h1>
            </div>
          </div>
          {(agent.agent_type === "shopping" || agent.agent_type === "hybrid") && (
            <div className="ml-auto flex items-center gap-2">
              <Input
                type="number"
                className="h-8 w-20"
                value={sessionBudget}
                onChange={(e) => setSessionBudget(e.target.value)}
                aria-label="Session budget USD"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={creatingSession}
                onClick={handleCreateShoppingSession}
              >
                {creatingSession ? "..." : "Start shop session"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-[var(--page-gutter)] py-6">
        <div className="mx-auto max-w-5xl space-y-6">
        {messages.length === 0 && (
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center text-muted-foreground animate-fade-in-up">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--brand)_10%,transparent)]">
                <Bot className="h-7 w-7 text-[var(--brand)] opacity-80" />
              </div>
              <p className="text-lg font-medium text-foreground">Start a conversation</p>
              <p className="mt-1 text-sm">Send a message to {agent.name}</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-4",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="chat-avatar chat-avatar-assistant">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] px-4 py-3",
                message.role === "user"
                  ? "chat-bubble-user"
                  : "chat-bubble-assistant"
              )}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
              {message.agentResponse && (
                <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
                  {renderPendingApprovals(message.agentResponse)}

                  {/* Tool Calls */}
                  {message.agentResponse.tool_calls && message.agentResponse.tool_calls.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Tool Calls:</h4>
                      <div className="space-y-2">
                        {message.agentResponse.tool_calls.map((toolCall, idx) => (
                          <Card key={idx} className="gap-3 py-4 shadow-none">
                            <CardContent className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline">{formatToolName(toolCall.tool)}</Badge>
                              </div>
                              <pre className="surface-row overflow-x-auto p-3 font-mono text-xs">
                                {JSON.stringify(toolCall.parameters, null, 2)}
                              </pre>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tool Results */}
                  {message.agentResponse.results && message.agentResponse.results.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Execution Results:</h4>
                      {message.agentResponse.results.map((result, idx) =>
                        renderToolResult(result, result.tool)
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
            {message.role === "user" && (
              <div className="chat-avatar chat-avatar-user">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start gap-4">
            <div className="chat-avatar chat-avatar-assistant">
              <Bot className="h-4 w-4" />
            </div>
            <div className="chat-bubble-assistant flex max-w-[85%] items-center gap-2 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-input-bar p-4">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[60px] max-h-[120px] resize-none rounded-2xl border-border/60 bg-card/60"
            disabled={isLoading || !agent || !agent.api_key}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !agent || !agent.api_key}
            size="icon-lg"
            variant="brand"
            className="h-[60px] w-[60px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

