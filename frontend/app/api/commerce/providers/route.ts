import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_API_URL || 'https://monad-backend-production.up.railway.app'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/commerce/providers`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to fetch providers' }, { status: response.status })
    }
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
