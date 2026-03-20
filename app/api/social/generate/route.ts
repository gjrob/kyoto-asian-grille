// Tier 2 Social Media — AI Post Generation API
// Copy to: clients/[slug]/app/api/social/generate/route.ts
// Canonical rule: lazy init inside handlers only (Rule 1)
// All posts insert as status: 'draft' — never auto-publish (Rule 10)

import { NextRequest, NextResponse } from 'next/server'
import { generateSocialPost } from '@/lib/social-content'
// SOURCE: shared/lib/social-content.ts — update both if changing

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CLIENT_SLUG = process.env.NEXT_PUBLIC_CLIENT_SLUG!

// POST — generate draft posts for all connected platforms
// Also called by Vercel cron (Mon/Wed/Fri 9am)
export async function POST(req: NextRequest) {
  // Authenticate cron requests
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isManual = !authHeader // manual trigger from dashboard

  if (!isCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // 1. Get brand voice
  const { data: voice, error: voiceErr } = await supabase
    .from('brand_voice')
    .select('*')
    .eq('client_slug', CLIENT_SLUG)
    .single()

  if (voiceErr || !voice) {
    return NextResponse.json(
      { error: 'Brand voice not configured. Set up brand voice first.' },
      { status: 400 }
    )
  }

  // 2. Get connected platforms
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('platform')
    .eq('client_slug', CLIENT_SLUG)

  // If no accounts connected yet, generate for facebook by default (for preview)
  const platforms: string[] =
    accounts && accounts.length > 0
      ? [...new Set(accounts.map((a: { platform: string }) => a.platform))]
      : ['facebook']

  // 3. Generate a post for each platform
  const inserted: string[] = []
  for (const platform of platforms) {
    try {
      const post = await generateSocialPost(
        CLIENT_SLUG,
        CLIENT_SLUG, // Will be replaced with actual business name from config
        platform as 'facebook' | 'instagram' | 'google_business',
        {
          tone: voice.tone,
          topics: voice.topics ?? [],
          hashtags: voice.hashtags ?? [],
          custom_instructions: voice.custom_instructions,
        }
      )

      // Always insert as draft — Rule 10: never auto-publish
      const { error: insertErr } = await supabase.from('social_posts').insert({
        client_slug: CLIENT_SLUG,
        platform,
        content_en: post.content_en,
        content_es: post.content_es || null,
        status: 'draft',
        created_at: new Date().toISOString(),
      })

      if (!insertErr) inserted.push(platform)
    } catch (err) {
      console.error(`[social/generate] Failed for ${platform}:`, err)
    }
  }

  return NextResponse.json({
    count: inserted.length,
    platforms: inserted,
  })
}

// GET handler for Vercel cron compatibility
export async function GET(req: NextRequest) {
  return POST(req)
}
