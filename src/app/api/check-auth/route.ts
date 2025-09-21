import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) {
    return NextResponse.json({ authenticated: false })
  }
  return NextResponse.json({ authenticated: true })
}
