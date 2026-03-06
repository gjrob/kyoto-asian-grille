'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const LEADS_TABLE = 'leads'
const CLIENT_SLUG = 'kyoto'
const ACCENT = '#dc2626'
const ACCENT_TEXT = '#ffffff'

interface Lead {
  id: string
  name: string
  phone?: string
  party_size?: number
  date?: string
  status: string
  created_at: string
}

interface NurtureMessage {
  id: string
  lead_name: string
  phone: string
  sequence_step: number
  status: string
  channel: string
  scheduled_at: string
}

function NurtureTab() {
  const [queue, setQueue] = useState<NurtureMessage[]>([])
  const [stats, setStats] = useState({ pending: 0, sent: 0, failed: 0, opted_out: 0 })

  useEffect(() => {
    supabase
      .from('nurture_queue')
      .select('*')
      .eq('client_slug', CLIENT_SLUG)
      .order('scheduled_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setQueue(data)
          setStats({
            pending:   data.filter(m => m.status === 'pending').length,
            sent:      data.filter(m => m.status === 'sent').length,
            failed:    data.filter(m => m.status === 'failed').length,
            opted_out: data.filter(m => m.status === 'opted_out').length,
          })
        }
      })
  }, [])

  const statusColor: Record<string, string> = {
    pending: '#ffaa00', sent: ACCENT, failed: '#ff4444', opted_out: '#6b7a8d',
  }

  return (
    <div style={{ margin: '24px 32px 48px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: '#1a2332', marginBottom: '24px' }}>
        {[
          { label: 'PENDING',  value: stats.pending,   color: '#ffaa00' },
          { label: 'SENT',     value: stats.sent,      color: ACCENT },
          { label: 'FAILED',   value: stats.failed,    color: '#ff4444' },
          { label: 'OPT-OUT',  value: stats.opted_out, color: '#6b7a8d' },
        ].map(s => (
          <div key={s.label} style={{ background: '#080b0f', padding: '20px 24px' }}>
            <div style={{ fontSize: '10px', color: '#6b7a8d', letterSpacing: '.1em' }}>{s.label}</div>
            <div style={{ fontSize: '40px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px', color: ACCENT, letterSpacing: '.15em', marginBottom: '12px' }}>// NURTURE QUEUE</div>
      {queue.length === 0 ? (
        <div style={{ color: '#6b7a8d', padding: '48px', textAlign: 'center', border: '1px solid #1a2332' }}>NO MESSAGES QUEUED YET</div>
      ) : (
        <div style={{ border: '1px solid #1a2332' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 60px 90px', padding: '10px 16px', background: '#0f1419', fontSize: '10px', color: '#6b7a8d', letterSpacing: '.1em', borderBottom: '1px solid #1a2332' }}>
            <span>NAME</span><span>SCHEDULED</span><span>STEP</span><span>CH</span><span>STATUS</span>
          </div>
          {queue.map((msg, i) => (
            <div key={msg.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 60px 90px', padding: '12px 16px', fontSize: '12px', borderBottom: i < queue.length - 1 ? '1px solid #0d1117' : 'none', background: i % 2 === 0 ? '#080b0f' : '#0a0e13', alignItems: 'center' }}>
              <span style={{ color: '#f0f4f8', fontWeight: 600 }}>{msg.lead_name}</span>
              <span style={{ color: '#6b7a8d' }}>{new Date(msg.scheduled_at).toLocaleDateString()}</span>
              <span style={{ color: '#6b7a8d' }}>Step {msg.sequence_step}</span>
              <span style={{ color: '#6b7a8d' }}>{msg.channel.toUpperCase()}</span>
              <span style={{ color: statusColor[msg.status] || '#666' }}>{msg.status.toUpperCase().replace('_', '-')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState({ today: 0, week: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [overlayActive, setOverlayActive] = useState(false)
  const [overlayMsg, setOverlayMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'leads' | 'nurture'>('leads')

  useEffect(() => {
    fetchLeads()
    fetchVenueStatus()
    const sub = supabase.channel('kyoto-reservations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: LEADS_TABLE, filter: `client_slug=eq.${CLIENT_SLUG}` },
        (payload) => {
          setLeads(prev => [payload.new as Lead, ...prev])
          setStats(prev => ({ ...prev, today: prev.today + 1, total: prev.total + 1 }))
        })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  async function fetchVenueStatus() {
    const { data } = await supabase.from('venue_status').select('is_open,specials_text').eq('client_slug', CLIENT_SLUG).single()
    if (data) {
      setOverlayActive(data.is_open)
      setOverlayMsg(data.specials_text || '')
    }
  }

  async function fetchLeads() {
    const { data } = await supabase.from(LEADS_TABLE).select('*').eq('client_slug', CLIENT_SLUG).order('created_at', { ascending: false }).limit(200)
    if (data) {
      setLeads(data)
      const today = new Date().toDateString()
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      setStats({
        today: data.filter(l => new Date(l.created_at).toDateString() === today).length,
        week: data.filter(l => new Date(l.created_at) >= weekAgo).length,
        total: data.length,
      })
    }
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from(LEADS_TABLE).update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  function exportCSV() {
    if (!leads.length) return
    const headers = Object.keys(leads[0]).join(',')
    const rows = leads.map(l => Object.values(l).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `kyoto-reservations-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const statusColor = (s: string) => (
    ({ pending: '#ffaa00', confirmed: '#39ff14', completed: '#00d4ff', cancelled: '#ff4444' } as Record<string, string>)[s] || '#666'
  )

  const tabStyle = (tab: 'leads' | 'nurture') => ({
    padding: '10px 28px',
    cursor: 'pointer' as const,
    fontFamily: 'monospace',
    fontSize: '11px',
    letterSpacing: '.1em',
    fontWeight: 700,
    border: 'none',
    background: 'transparent',
    color: activeTab === tab ? ACCENT : '#6b7a8d',
    borderBottom: activeTab === tab ? `2px solid ${ACCENT}` : '2px solid transparent',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#080b0f', color: '#f0f4f8', fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ borderBottom: `2px solid ${ACCENT}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '10px', color: ACCENT, letterSpacing: '.15em' }}>// DASHBOARD</div>
          <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '.05em' }}>KYOTO ASIAN GRILLE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '22px', color: ACCENT, fontWeight: 400, letterSpacing: '.05em', opacity: 0.85 }}>京都</span>
          <button onClick={exportCSV} style={{ background: 'transparent', border: `1px solid ${ACCENT}`, color: ACCENT, padding: '8px 20px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '.1em' }}>
            EXPORT CSV
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #1a2332', display: 'flex', padding: '0 32px' }}>
        <button onClick={() => setActiveTab('leads')} style={tabStyle('leads')}>LEADS</button>
        <button onClick={() => setActiveTab('nurture')} style={tabStyle('nurture')}>NURTURE</button>
      </div>

      {activeTab === 'leads' ? (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: '#1a2332' }}>
            {[{ label: 'TODAY', value: stats.today }, { label: 'THIS WEEK', value: stats.week }, { label: 'ALL TIME', value: stats.total }].map(s => (
              <div key={s.label} style={{ background: '#080b0f', padding: '28px 32px' }}>
                <div style={{ fontSize: '10px', color: '#6b7a8d', letterSpacing: '.1em', marginBottom: '8px' }}>{s.label}</div>
                <div style={{ fontSize: '56px', fontWeight: 700, color: ACCENT, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: '#6b7a8d', marginTop: '4px' }}>RESERVATIONS</div>
              </div>
            ))}
          </div>

          {/* Overlay Control */}
          <div style={{ margin: '24px 32px', border: '1px solid #1a2332', padding: '20px' }}>
            <div style={{ fontSize: '10px', color: ACCENT, letterSpacing: '.15em', marginBottom: '12px' }}>// OVERLAY CONTROL</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                value={overlayMsg}
                onChange={e => setOverlayMsg(e.target.value)}
                placeholder="e.g. Hibachi available tonight — reserve your seat"
                style={{ flex: 1, background: '#0f1419', border: '1px solid #1a2332', color: '#f0f4f8', padding: '10px 16px', fontFamily: 'monospace', fontSize: '13px', outline: 'none' }}
              />
              <button
                onClick={async () => {
                  const next = !overlayActive
                  setOverlayActive(next)
                  await supabase.from('venue_status').upsert(
                    { client_slug: CLIENT_SLUG, is_open: next, specials_text: overlayMsg },
                    { onConflict: 'client_slug' }
                  )
                }}
                style={{ background: overlayActive ? '#ff4444' : ACCENT, color: ACCENT_TEXT, border: 'none', padding: '10px 28px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', letterSpacing: '.1em' }}
              >
                {overlayActive ? 'STOP' : 'GO LIVE'}
              </button>
            </div>
            {overlayActive && (
              <div style={{ marginTop: '12px', padding: '10px 16px', background: 'rgba(220,38,38,.06)', border: `1px solid ${ACCENT}`, fontSize: '12px', color: ACCENT }}>
                ● LIVE — &quot;{overlayMsg || 'No message set'}&quot;
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ margin: '0 32px 48px' }}>
            <div style={{ fontSize: '10px', color: ACCENT, letterSpacing: '.15em', marginBottom: '12px' }}>// RESERVATIONS — REAL TIME</div>
            {loading ? (
              <div style={{ color: '#6b7a8d', padding: '48px', textAlign: 'center' }}>LOADING...</div>
            ) : leads.length === 0 ? (
              <div style={{ color: '#6b7a8d', padding: '48px', textAlign: 'center', border: '1px solid #1a2332' }}>NO RESERVATIONS YET</div>
            ) : (
              <div style={{ border: '1px solid #1a2332' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.75fr 1fr 1fr', padding: '10px 16px', background: '#0f1419', fontSize: '10px', color: '#6b7a8d', letterSpacing: '.1em', borderBottom: '1px solid #1a2332' }}>
                  <span>NAME</span><span>PHONE</span><span>PARTY SIZE</span><span>DATE</span><span>STATUS</span>
                </div>
                {leads.map((lead, i) => (
                  <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.75fr 1fr 1fr', padding: '14px 16px', fontSize: '12px', borderBottom: i < leads.length - 1 ? '1px solid #0d1117' : 'none', background: i % 2 === 0 ? '#080b0f' : '#0a0e13', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#f0f4f8' }}>{lead.name}</span>
                    <span style={{ color: '#6b7a8d' }}>{lead.phone || '—'}</span>
                    <span style={{ color: '#6b7a8d', textAlign: 'center' }}>{lead.party_size ?? '—'}</span>
                    <span style={{ color: '#6b7a8d' }}>{lead.date || '—'}</span>
                    <select
                      value={lead.status}
                      onChange={e => updateStatus(lead.id, e.target.value)}
                      style={{ background: '#0f1419', border: `1px solid ${statusColor(lead.status)}`, color: statusColor(lead.status), padding: '4px 8px', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer' }}
                    >
                      <option value="pending">PENDING</option>
                      <option value="confirmed">CONFIRMED</option>
                      <option value="completed">COMPLETED</option>
                      <option value="cancelled">CANCELLED</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <NurtureTab />
      )}
    </div>
  )
}
