// Tier 2 Social Media — Analytics Pull-back API
// Copy to: clients/[slug]/app/api/social/analytics/route.ts
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

// GET — pull engagement data from platforms and upsert into post_analytics
// Called by Vercel cron daily at 6am
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  // Allow manual calls without auth for dashboard refresh
  const isManual = !authHeader

  if (!isCron && !isManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // 1. Get all sent posts that have platform_post_ids
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, platform, platform_post_id')
    .eq('client_slug', CLIENT_SLUG)
    .eq('status', 'sent')
    .not('platform_post_id', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!posts || posts.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No sent posts with platform IDs' })
  }

  // 2. Get platform tokens
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('client_slug', CLIENT_SLUG)

  const tokenMap = new Map<string, string>()
  for (const acc of accounts ?? []) {
    tokenMap.set(acc.platform, acc.access_token)
  }

  // 3. Pull analytics for each post
  let updated = 0
  for (const post of posts) {
    const token = tokenMap.get(post.platform)
    if (!token) continue

    try {
      // TODO: Wire platform-specific analytics calls here
      // Facebook: GET https://graph.facebook.com/v18.0/{post_id}/insights
      // Instagram: GET https://graph.facebook.com/v18.0/{media_id}/insights
      // Google Business: GET localPosts/{id}/metrics

      // Placeholder — will be replaced when OAuth is wired
      const analytics = {
        impressions: 0,
        reach: 0,
        engagement: 0,
        clicks: 0,
      }

      await supabase.from('post_analytics').upsert(
        {
          post_id: post.id,
          client_slug: CLIENT_SLUG,
          impressions: analytics.impressions,
          reach: analytics.reach,
          engagement: analytics.engagement,
          clicks: analytics.clicks,
          pulled_at: new Date().toISOString(),
        },
        { onConflict: 'post_id' }
      )

      updated++
    } catch (err) {
      console.error(`[social/analytics] Failed for post ${post.id}:`, err)
    }
  }

  return NextResponse.json({ updated })
}
