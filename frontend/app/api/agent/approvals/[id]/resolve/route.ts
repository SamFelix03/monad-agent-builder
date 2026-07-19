import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BACKEND_URL = process.env.BACKEND_API_URL || 'https://monad-backend-production.up.railway.app'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { status, resolvedBy } = await request.json()

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/approvals/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolvedBy: resolvedBy || 'user' }),
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to resolve approval' }, { status: response.status })
    }

    // Sync to Supabase if available
    await supabase
      .from('agent_approvals')
      .update({
        status,
        resolved_by: resolvedBy || 'user',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .then(() => {})

    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
