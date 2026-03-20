'use client'

// Tier 2 Social Media — Brand Voice Settings
// Copy to: clients/[slug]/app/dashboard/social/settings/page.tsx
// Uses globals.css pattern — no Tailwind, no CSS modules

import { useState, useEffect } from 'react'

interface BrandVoiceData {
  tone: string
  post_frequency: number
  topics: string[]
  hashtags: string[]
  custom_instructions: string
}

const TONE_OPTIONS = [
  'friendly',
  'professional',
  'casual',
  'witty',
  'warm',
  'bold',
  'inspirational',
]

const EMPTY_VOICE: BrandVoiceData = {
  tone: 'friendly',
  post_frequency: 3,
  topics: [],
  hashtags: [],
  custom_instructions: '',
}

export default function SocialSettingsPage() {
  const [voice, setVoice] = useState<BrandVoiceData>(EMPTY_VOICE)
  const [topicInput, setTopicInput] = useState('')
  const [hashtagInput, setHashtagInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/social/settings')
      .then(r => r.json())
      .then(data => {
        if (data.voice) setVoice(data.voice)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function addTopic() {
    const val = topicInput.trim()
    if (!val || voice.topics.includes(val)) return
    setVoice(v => ({ ...v, topics: [...v.topics, val] }))
    setTopicInput('')
  }

  function removeTopic(t: string) {
    setVoice(v => ({ ...v, topics: v.topics.filter(x => x !== t) }))
  }

  function addHashtag() {
    const val = hashtagInput.trim().replace(/^#/, '')
    if (!val || voice.hashtags.includes(val)) return
    setVoice(v => ({ ...v, hashtags: [...v.hashtags, val] }))
    setHashtagInput('')
  }

  function removeHashtag(h: string) {
    setVoice(v => ({ ...v, hashtags: v.hashtags.filter(x => x !== h) }))
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const r = await fetch('/api/social/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voice),
      })
      if (!r.ok) {
        const json = await r.json()
        setError(json.error ?? 'Save failed')
        return
      }
      setSuccess('Brand voice saved.')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="social-settings-loading">Loading brand voice...</div>
  }

  return (
    <div className="social-settings">
      <div className="social-settings-header">
        <h1>Brand Voice Settings</h1>
        <p>Configure how AI generates social media posts for your business.</p>
      </div>

      {success && <div className="social-banner social-banner--success">{success}</div>}
      {error && <div className="social-banner social-banner--error">{error}</div>}

      <div className="social-settings-form">
        {/* Tone */}
        <div className="social-field">
          <label className="social-label">Tone</label>
          <select
            className="social-select"
            value={voice.tone}
            onChange={e => setVoice(v => ({ ...v, tone: e.target.value }))}
          >
            {TONE_OPTIONS.map(t => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Post Frequency */}
        <div className="social-field">
          <label className="social-label">Posts per Week</label>
          <input
            className="social-input"
            type="number"
            min={1}
            max={7}
            value={voice.post_frequency}
            onChange={e =>
              setVoice(v => ({
                ...v,
                post_frequency: Math.max(1, Math.min(7, parseInt(e.target.value) || 3)),
              }))
            }
          />
        </div>

        {/* Topics */}
        <div className="social-field">
          <label className="social-label">Topics</label>
          <div className="social-tag-input">
            <input
              className="social-input"
              placeholder="Add a topic and press Enter"
              value={topicInput}
              onChange={e => setTopicInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTopic()
                }
              }}
            />
          </div>
          <div className="social-tags">
            {voice.topics.map(t => (
              <span key={t} className="social-tag">
                {t}
                <button className="social-tag-remove" onClick={() => removeTopic(t)}>
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Hashtags */}
        <div className="social-field">
          <label className="social-label">Hashtags</label>
          <div className="social-tag-input">
            <input
              className="social-input"
              placeholder="Add a hashtag and press Enter"
              value={hashtagInput}
              onChange={e => setHashtagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addHashtag()
                }
              }}
            />
          </div>
          <div className="social-tags">
            {voice.hashtags.map(h => (
              <span key={h} className="social-tag social-tag--hashtag">
                #{h}
                <button className="social-tag-remove" onClick={() => removeHashtag(h)}>
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        <div className="social-field">
          <label className="social-label">Custom Instructions</label>
          <textarea
            className="social-textarea"
            rows={4}
            placeholder="Any special instructions for the AI post generator..."
            value={voice.custom_instructions}
            onChange={e => setVoice(v => ({ ...v, custom_instructions: e.target.value }))}
          />
        </div>

        <button
          className="social-btn social-btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Brand Voice'}
        </button>
      </div>
    </div>
  )
}
