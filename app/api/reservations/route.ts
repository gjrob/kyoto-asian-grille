import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone, party_size, date, time, notes } = body

  if (!name || !phone || !party_size || !date || !time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('kyoto_reservations')
    .insert({ name, email, phone, party_size, date, time, notes, client_slug: 'kyoto' })
    .select()
    .single()

  if (error) {
    console.error('Reservation error:', error)
    return NextResponse.json({ error: 'Failed to save reservation' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
