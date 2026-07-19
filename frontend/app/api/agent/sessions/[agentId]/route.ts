import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL || 'https://monad-backend-production.up.railway.app'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const body = await request.json()
    const { userId, budgetUsd, merchantAllowlist, expiresInHours } = body

    if (!userId || budgetUsd == null) {
      return NextResponse.json({ error: 'userId and budgetUsd required' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/agents/${agentId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, budgetUsd, merchantAllowlist, expiresInHours }),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to create session' }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const response = await fetch(`${BACKEND_URL}/agents/${agentId}/sessions/active`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
