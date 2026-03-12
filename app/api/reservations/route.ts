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

  // Attempt insert including client_slug. If the column doesn't exist (old schema),
  // retry without it so the API still works while we migrate the database.
  let data: any, error: any

  ({ data, error } = await supabase
    .from('kyoto_reservations')
    .insert({ name, email, phone, party_size, date, time, notes, client_slug: 'kyoto' })
    .select()
    .single())

  if (error && error.code === 'PGRST204' && /client_slug/.test(error.message)) {
    console.warn('Column client_slug missing, retrying without it');
    ({ data, error } = await supabase
      .from('kyoto_reservations')
      .insert({ name, email, phone, party_size, date, time, notes })
      .select()
      .single())
  }

  if (error) {
    console.error('Reservation error:', error)
    return NextResponse.json({ error: 'Failed to save reservation' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
