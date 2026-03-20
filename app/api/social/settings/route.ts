// Tier 2 Social Media — Brand Voice Settings API
// Copy to: clients/[slug]/app/api/social/settings/route.ts
// Canonical rule: lazy init inside handlers only (Rule 1)

import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CLIENT_SLUG = process.env.NEXT_PUBLIC_CLIENT_SLUG!

// GET — fetch brand voice (and optionally posts by status)
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)

  // If ?posts=true&status=draft, return posts instead
  if (searchParams.get('posts') === 'true') {
    const status = searchParams.get('status') ?? 'draft'
    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('client_slug', CLIENT_SLUG)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ posts: data })
  }

  // Default: return brand voice
  const { data, error } = await supabase
    .from('brand_voice')
    .select('*')
    .eq('client_slug', CLIENT_SLUG)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ voice: data ?? null })
}

// POST — upsert brand voice
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()

  const { tone, post_frequency, topics, hashtags, custom_instructions } = body

  const { data, error } = await supabase
    .from('brand_voice')
    .upsert(
      {
        client_slug: CLIENT_SLUG,
        tone: tone ?? 'friendly',
        post_frequency: post_frequency ?? 3,
        topics: topics ?? [],
        hashtags: hashtags ?? [],
        custom_instructions: custom_instructions ?? '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_slug' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ voice: data })
}
