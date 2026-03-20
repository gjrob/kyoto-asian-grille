// Tier 2 Social Media — Post Publish / Approval API
// Copy to: clients/[slug]/app/api/social/publish/route.ts
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

// POST — approve, edit, reject, or schedule a post
export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { post_id, action, content_en, content_es, scheduled_for } = body

  if (!post_id || !action) {
    return NextResponse.json({ error: 'post_id and action required' }, { status: 400 })
  }

  // Verify post belongs to this client
  const { data: post, error: fetchErr } = await supabase
    .from('social_posts')
    .select('*')
    .eq('id', post_id)
    .eq('client_slug', CLIENT_SLUG)
    .single()

  if (fetchErr || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (action === 'approve') {
    const updates: Record<string, unknown> = { status: 'approved' }
    if (scheduled_for) {
      updates.status = 'scheduled'
      updates.scheduled_for = scheduled_for
    }
    const { error } = await supabase
      .from('social_posts')
      .update(updates)
      .eq('id', post_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, status: updates.status })
  }

  if (action === 'edit') {
    const updates: Record<string, unknown> = {}
    if (content_en !== undefined) updates.content_en = content_en
    if (content_es !== undefined) updates.content_es = content_es
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    const { error } = await supabase
      .from('social_posts')
      .update(updates)
      .eq('id', post_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', post_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// GET — cron handler: publish approved/scheduled posts whose time has come
// Vercel cron calls this every 15 minutes
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // Find posts ready to publish
  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('client_slug', CLIENT_SLUG)
    .in('status', ['approved', 'scheduled'])
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!posts || posts.length === 0) {
    return NextResponse.json({ published: 0 })
  }

  // Get platform tokens
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('client_slug', CLIENT_SLUG)

  const tokenMap = new Map<string, string>()
  for (const acc of accounts ?? []) {
    tokenMap.set(acc.platform, acc.access_token)
  }

  let published = 0
  for (const post of posts) {
    const token = tokenMap.get(post.platform)
    if (!token) {
      // No token for this platform — mark failed
      await supabase
        .from('social_posts')
        .update({ status: 'failed' })
        .eq('id', post.id)
      continue
    }

    try {
      // TODO: Wire platform-specific publish calls here
      // For now, mark as sent with a placeholder
      // Facebook: POST https://graph.facebook.com/v18.0/{page_id}/feed
      // Instagram: POST https://graph.facebook.com/v18.0/{ig_user_id}/media
      // Google Business: POST https://mybusiness.googleapis.com/v4/accounts/{id}/locations/{id}/localPosts

      await supabase
        .from('social_posts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          // platform_post_id will be set when real API calls are wired
        })
        .eq('id', post.id)

      published++
    } catch (err) {
      console.error(`[social/publish] Failed for post ${post.id}:`, err)
      await supabase
        .from('social_posts')
        .update({ status: 'failed' })
        .eq('id', post.id)
    }
  }

  return NextResponse.json({ published })
}
