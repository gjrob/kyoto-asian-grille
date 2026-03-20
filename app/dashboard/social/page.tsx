'use client'

// Tier 2 Social Media — Post Approval Dashboard
// Copy to: clients/[slug]/app/dashboard/social/page.tsx
// Uses globals.css pattern — no Tailwind, no CSS modules

import { useState, useEffect, useCallback } from 'react'

interface SocialPost {
  id: string
  client_slug: string
  platform: string
  content_en: string
  content_es: string | null
  image_url: string | null
  status: 'draft' | 'approved' | 'scheduled' | 'sent' | 'failed'
  scheduled_for: string | null
  sent_at: string | null
  platform_post_id: string | null
  created_at: string
}

type Tab = 'draft' | 'approved' | 'sent' | 'failed'

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google_business: 'Google Business',
}

export default function SocialDashboard() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('draft')
  const [editId, setEditId] = useState<string | null>(null)
  const [editEn, setEditEn] = useState('')
  const [editEs, setEditEs] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/social/settings?posts=true&status=${tab}`)
      const json = await r.json()
      if (r.ok) setPosts(json.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  async function handleApprove(id: string) {
    const r = await fetch('/api/social/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: id, action: 'approve' }),
    })
    if (r.ok) {
      setMessage('Post approved.')
      setTimeout(() => setMessage(''), 3000)
      fetchPosts()
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Reject this post? It will be removed from the queue.')) return
    const r = await fetch('/api/social/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: id, action: 'reject' }),
    })
    if (r.ok) {
      setMessage('Post rejected.')
      setTimeout(() => setMessage(''), 3000)
      fetchPosts()
    }
  }

  async function handleSaveEdit(id: string) {
    const r = await fetch('/api/social/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: id,
        action: 'edit',
        content_en: editEn,
        content_es: editEs,
      }),
    })
    if (r.ok) {
      setEditId(null)
      setMessage('Post updated.')
      setTimeout(() => setMessage(''), 3000)
      fetchPosts()
    }
  }

  function startEdit(post: SocialPost) {
    setEditId(post.id)
    setEditEn(post.content_en)
    setEditEs(post.content_es ?? '')
  }

  async function handleGenerate() {
    setGenerating(true)
    setMessage('')
    try {
      const r = await fetch('/api/social/generate', { method: 'POST' })
      const json = await r.json()
      if (r.ok) {
        setMessage(`Generated ${json.count ?? 0} draft posts.`)
        setTimeout(() => setMessage(''), 5000)
        if (tab === 'draft') fetchPosts()
      } else {
        setMessage(json.error ?? 'Generation failed.')
      }
    } catch {
      setMessage('Network error.')
    } finally {
      setGenerating(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'draft', label: 'Drafts' },
    { key: 'approved', label: 'Approved' },
    { key: 'sent', label: 'Sent' },
    { key: 'failed', label: 'Failed' },
  ]

  return (
    <div className="social-dashboard">
      <div className="social-dashboard-header">
        <div>
          <h1>Social Media Posts</h1>
          <p>Review, edit, and approve AI-generated posts before they go live.</p>
        </div>
        <button
          className="social-btn social-btn--primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate Posts'}
        </button>
      </div>

      {message && <div className="social-banner social-banner--success">{message}</div>}

      {/* Tabs */}
      <div className="social-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`social-tab ${tab === t.key ? 'social-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="social-loading">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="social-empty">
          {tab === 'draft'
            ? 'No drafts. Click "Generate Posts" to create new content.'
            : `No ${tab} posts.`}
        </div>
      ) : (
        <div className="social-posts-grid">
          {posts.map(post => (
            <div key={post.id} className="social-post-card">
              <div className="social-post-meta">
                <span className={`social-platform social-platform--${post.platform}`}>
                  {PLATFORM_LABELS[post.platform] ?? post.platform}
                </span>
                <span className="social-post-date">
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
              </div>

              {editId === post.id ? (
                /* Edit mode */
                <div className="social-post-edit">
                  <div className="social-post-bilingual">
                    <div className="social-post-lang">
                      <label className="social-label">English</label>
                      <textarea
                        className="social-textarea"
                        rows={5}
                        value={editEn}
                        onChange={e => setEditEn(e.target.value)}
                      />
                    </div>
                    <div className="social-post-lang">
                      <label className="social-label">Espa&ntilde;ol</label>
                      <textarea
                        className="social-textarea"
                        rows={5}
                        value={editEs}
                        onChange={e => setEditEs(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="social-post-actions">
                    <button
                      className="social-btn social-btn--primary"
                      onClick={() => handleSaveEdit(post.id)}
                    >
                      Save
                    </button>
                    <button
                      className="social-btn social-btn--secondary"
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="social-post-bilingual">
                    <div className="social-post-lang">
                      <div className="social-lang-label">EN</div>
                      <div className="social-post-content">{post.content_en}</div>
                    </div>
                    {post.content_es && (
                      <div className="social-post-lang">
                        <div className="social-lang-label">ES</div>
                        <div className="social-post-content">{post.content_es}</div>
                      </div>
                    )}
                  </div>

                  {post.status === 'draft' && (
                    <div className="social-post-actions">
                      <button
                        className="social-btn social-btn--approve"
                        onClick={() => handleApprove(post.id)}
                      >
                        Approve
                      </button>
                      <button
                        className="social-btn social-btn--secondary"
                        onClick={() => startEdit(post)}
                      >
                        Edit
                      </button>
                      <button
                        className="social-btn social-btn--reject"
                        onClick={() => handleReject(post.id)}
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {post.status === 'sent' && post.sent_at && (
                    <div className="social-post-sent-info">
                      Sent {new Date(post.sent_at).toLocaleString()}
                      {post.platform_post_id && (
                        <span className="social-post-id"> · {post.platform_post_id}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
