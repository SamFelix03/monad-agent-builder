"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Panel,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from "reactflow"
import "reactflow/dist/style.css"
import { toast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Save, ArrowLeft } from "lucide-react"
import { ToolLibraryPanel } from "./tool-library-panel"
import { NodeConfigFloatingPanel } from "./node-config-floating-panel"
import CustomEdge from "./custom-edge"
import { ToolNode } from "./nodes/tool-node"
import { AgentNode } from "./nodes/agent-node"
import { generateNodeId, createNode, enrichNodesFromRegistry } from "@/lib/workflow-utils"
import type { WorkflowNode } from "@/lib/types"
import { AIChatModal } from "./ai-chat-modal"
import { useAuth } from "@/lib/auth"
import { createAgent, getAgentById, updateAgent } from "@/lib/agents"
import { workflowToTools, toolsToWorkflow } from "@/lib/workflow-converter"
import { getWorkflowToolTypes } from "@/lib/tool-registry"
import { inferAgentType, aggregateToolsPolicies } from "@/lib/policies"
import { buildTemplateWorkflow } from "@/lib/template-builder"
import { TOOL_PANEL_CHROME_LEFT } from "@/lib/workflow-layout"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const workflowToolTypes = getWorkflowToolTypes()

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  default: ToolNode,
  ...Object.fromEntries(workflowToolTypes.map((t) => [t, ToolNode])),
}

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
}

interface WorkflowBuilderProps {
  agentId?: string
}

const AGENT_NODE_ID = "agent-node"

// Create the initial agent node
const createAgentNode = (): Node => ({
  id: AGENT_NODE_ID,
  type: "agent",
  position: { x: 100, y: 100 },
  data: {
    label: "Agent",
    description: "Your agent",
    config: {},
  },
  draggable: true,
  selectable: true,
  deletable: false,
})

export default function WorkflowBuilder({ agentId }: WorkflowBuilderProps) {
  const router = useRouter()
  const { user, authenticated } = useAuth()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([createAgentNode()])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const [isAIChatOpen, setIsAIChatOpen] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [agentName, setAgentName] = useState("")
  const [agentDescription, setAgentDescription] = useState("")
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [loadingAgent, setLoadingAgent] = useState(false)
  const [saving, setSaving] = useState(false)

  // Wrapper for onNodesChange to prevent agent node deletion
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      // Filter out any delete operations on the agent node
      const filteredChanges = changes.filter((change) => {
        if (change.type === "remove" && change.id === AGENT_NODE_ID) {
          return false
        }
        return true
      })
      onNodesChange(filteredChanges)
      
      // Ensure agent node always exists
      setNodes((nds) => {
        const hasAgentNode = nds.some((node) => node.id === AGENT_NODE_ID)
        if (!hasAgentNode) {
          return [...nds, createAgentNode()]
        }
        return nds
      })
    },
    [onNodesChange, setNodes],
  )

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, type: "custom" }, eds)),
    [setEdges],
  )

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      const type = event.dataTransfer.getData("application/reactflow")

      // Check if the dropped element is valid
      if (typeof type === "undefined" || !type || !workflowToolTypes.includes(type)) {
        return
      }

      if (reactFlowBounds && reactFlowInstance) {
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        })

        const newNode = createNode({
          type,
          position,
          id: generateNodeId(type),
        })

        setNodes((nds) => {
          const updatedNodes = enrichNodesFromRegistry(nds.concat(newNode))
          // Auto-connect new node to agent node if it's a starting node
          // (nodes with no incoming edges will be connected to agent)
          setEdges((eds) => {
            // Check if this node already has incoming edges
            const hasIncoming = eds.some((edge) => edge.target === newNode.id)
            // If no incoming edges, connect to agent node
            if (!hasIncoming) {
              const agentEdge: Edge = {
                id: `edge-${AGENT_NODE_ID}-${newNode.id}`,
                source: AGENT_NODE_ID,
                target: newNode.id,
                type: "custom",
              }
              return [...eds, agentEdge]
            }
            return eds
          })
          return updatedNodes
        })
      }
    },
    [reactFlowInstance, setNodes, setEdges],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const updateNodeData = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...data,
              },
            }
          }
          return node
        }),
      )
    },
    [setNodes],
  )

  const applyTemplate = useCallback(
    (templateKey: string) => {
      const built = buildTemplateWorkflow(templateKey, AGENT_NODE_ID)
      if (!built) {
        toast({
          title: "Unknown template",
          description: "Could not load that template",
          variant: "destructive",
        })
        return
      }

      const agentNode = createAgentNode()
      const allNodes = enrichNodesFromRegistry([agentNode, ...built.nodes])
      setNodes(allNodes)
      setEdges(built.edges)
      setActiveTemplate(templateKey)

      if (!agentName.trim()) setAgentName(built.name)
      if (!agentDescription.trim()) setAgentDescription(built.description)

      setTimeout(() => {
        reactFlowInstance?.fitView({ padding: 0.2 })
      }, 100)

      toast({
        title: "Template applied",
        description: built.description || "Tool chain added to canvas",
      })
    },
    [reactFlowInstance, agentName, agentDescription, setNodes, setEdges],
  )

  const handleSaveClick = () => {
    // Check if there are any tool nodes (excluding agent node)
    const toolNodes = nodes.filter((node) => node.id !== AGENT_NODE_ID)
    if (toolNodes.length === 0) {
      toast({
        title: "Nothing to save",
        description: "Add some tools to your workflow first",
        variant: "destructive",
      })
      return
    }

    if (!authenticated || !user?.id) {
      toast({
        title: "Not authenticated",
        description: "Please log in to save your workflow",
        variant: "destructive",
      })
      return
    }

    // Show the save dialog
    setShowSaveDialog(true)
  }

  const saveWorkflow = async () => {
    if (!agentName.trim()) {
      toast({
        title: "Agent name required",
        description: "Please enter a name for your agent",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const tools = workflowToTools(nodes, edges, AGENT_NODE_ID)
      const toolNames = tools.map((t) => t.tool)
      const resolvedType = inferAgentType(toolNames)
      const policies = aggregateToolsPolicies(tools)

      if (agentId) {
        await updateAgent(agentId, {
          name: agentName,
          description: agentDescription || null,
          tools,
          agent_type: resolvedType,
          policies,
        })
        toast({
          title: "Agent updated",
          description: "Your agent has been updated successfully",
        })
        setShowSaveDialog(false)
        // Redirect to my-agents page
        router.push("/my-agents")
      } else {
        // Create new agent
        if (!user?.id) {
          toast({
            title: "Error",
            description: "User not authenticated",
            variant: "destructive",
          })
          return
        }
        const agent = await createAgent(user.id, agentName, agentDescription || null, tools, {
          agent_type: resolvedType,
          policies,
        })
        toast({
          title: "Agent created",
          description: "Your agent has been created successfully",
        })
        setShowSaveDialog(false)
        // Redirect to my-agents page
        router.push("/my-agents")
      }
    } catch (error: any) {
      console.error("Error saving agent:", error)
      toast({
        title: "Error saving agent",
        description: error.message || "Failed to save agent",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }



  const handleBackClick = () => {
    // Check for unsaved changes (excluding agent node)
    const toolNodes = nodes.filter((node) => node.id !== AGENT_NODE_ID)
    const toolEdges = edges.filter((edge) => edge.source !== AGENT_NODE_ID && edge.target !== AGENT_NODE_ID)
    const hasUnsavedChanges = toolNodes.length > 0 || toolEdges.length > 0
    if (hasUnsavedChanges) {
      setShowExitDialog(true)
    } else {
      router.push("/my-agents")
    }
  }

  const handleConfirmExit = () => {
    setShowExitDialog(false)
    router.push("/my-agents")
  }

  // Load agent if agentId is provided
  useEffect(() => {
    if (agentId && authenticated && user?.id) {
      loadAgent()
    }
  }, [agentId, authenticated, user])

  const loadAgent = async () => {
    if (!agentId) return
    setLoadingAgent(true)
    try {
      const agent = await getAgentById(agentId)
      if (agent) {
        // Verify ownership
        if (agent.user_id !== user?.id) {
          toast({
            title: "Access denied",
            description: "You don't have permission to access this agent",
            variant: "destructive",
          })
          router.push("/my-agents")
          return
        }

        setAgentName(agent.name)
        setAgentDescription(agent.description || "")
        if (agent.tools && agent.tools.length > 0) {
          const { nodes: loadedNodes, edges: loadedEdges } = toolsToWorkflow(agent.tools, AGENT_NODE_ID)
          const allNodes = enrichNodesFromRegistry([createAgentNode(), ...loadedNodes])
          setNodes(allNodes)
          setEdges(loadedEdges)
          
          // Fit view to show all nodes after loading
          setTimeout(() => {
            if (reactFlowInstance) {
              reactFlowInstance.fitView({ padding: 0.2 })
            }
          }, 100)
        } else {
          // Even if no tools, ensure agent node exists
          setNodes([createAgentNode()])
          setEdges([])
        }
      }
    } catch (error) {
      console.error("Error loading agent:", error)
      toast({
        title: "Error loading agent",
        description: "Failed to load agent data",
        variant: "destructive",
      })
    } finally {
      setLoadingAgent(false)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="workflow-canvas relative h-full min-h-0 w-full" ref={reactFlowWrapper}>
        <ReactFlowProvider>
          <ReactFlow
            className="h-full w-full"
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{ type: "custom" }}
          >
            <Background />
            <Controls
              className="!bottom-3"
              style={{ left: TOOL_PANEL_CHROME_LEFT }}
            />
            <MiniMap className="!right-3 !bottom-3" />
            <Panel position="top-right" className="!m-3">
              <div className="toolbar-pill">
                <Button onClick={handleSaveClick} size="sm" variant="outline" disabled={loadingAgent}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {agentId ? "Update Agent" : "Save Agent"}
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>

        <div
          className="pointer-events-none absolute top-4 z-30"
          style={{ left: TOOL_PANEL_CHROME_LEFT }}
        >
          <div className="toolbar-pill pointer-events-auto">
            <Button
              onClick={handleBackClick}
              size="sm"
              variant="ghost"
              className="rounded-full"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setIsAIChatOpen(true)}
              size="sm"
              variant="brand"
            >
              Create with AI
            </Button>
          </div>
        </div>

        <ToolLibraryPanel
          activeTemplate={activeTemplate}
          onSelectTemplate={applyTemplate}
          disabled={loadingAgent}
        />

        {selectedNode && selectedNode.id !== AGENT_NODE_ID && (
          <NodeConfigFloatingPanel
            node={selectedNode as WorkflowNode}
            updateNodeData={updateNodeData}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      <AIChatModal
        open={isAIChatOpen}
        onOpenChange={setIsAIChatOpen}
        onApplyWorkflow={(aiNodes, aiEdges) => {
          // Ensure agent node is included and connect starting nodes to it
          const agentNode = createAgentNode()
          const allNodes = enrichNodesFromRegistry([agentNode, ...aiNodes])
          
          // Find starting nodes (nodes with no incoming edges)
          const nodesWithIncoming = new Set<string>()
          aiEdges.forEach((edge) => {
            nodesWithIncoming.add(edge.target)
          })
          
          // Connect all starting nodes to agent node
          const agentEdges: Edge[] = aiNodes
            .filter((node) => !nodesWithIncoming.has(node.id))
            .map((node) => ({
              id: `edge-${AGENT_NODE_ID}-${node.id}`,
              source: AGENT_NODE_ID,
              target: node.id,
              type: "custom" as const,
            }))
          
          setNodes(allNodes)
          setEdges([...agentEdges, ...aiEdges])
          
          // Fit view to show all nodes
          setTimeout(() => {
            if (reactFlowInstance) {
              reactFlowInstance.fitView({ padding: 0.2 })
            }
          }, 100)
          toast({
            title: "Workflow applied",
            description: "AI-generated workflow has been applied to the canvas",
          })
        }}
      />

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Agent Builder?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your workflow. If you leave now, all your progress will be lost. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmExit}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{agentId ? "Update Agent" : "Create Agent"}</DialogTitle>
            <DialogDescription>
              Name your agent. Tool chains and per-node guardrails are saved from the canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name *</Label>
              <Input
                id="agent-name"
                placeholder="My Agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-description">Description (optional)</Label>
              <Textarea
                id="agent-description"
                placeholder="Describe what this agent does..."
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {nodes.filter((n) => n.id !== AGENT_NODE_ID).length} tool
              {nodes.filter((n) => n.id !== AGENT_NODE_ID).length === 1 ? "" : "s"} configured.
              Click any tool node to edit its guardrails.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveWorkflow} disabled={saving || !agentName.trim()}>
              {saving ? "Saving..." : agentId ? "Update Agent" : "Create Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
