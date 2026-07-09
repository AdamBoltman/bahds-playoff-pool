import { useEffect, useState } from 'react'
import { fetchScheduleDay, fetchGameHighlights, shiftDate } from '../lib/nhl.js'

function formatDay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T12:00:00Z`)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = shiftDate(today, -1)
  const tomorrow = shiftDate(today, 1)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  if (dateStr === tomorrow) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function SchedulePage() {
  const [day, setDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [highlights, setHighlights] = useState({})

  useEffect(() => { load('now') }, [])

  async function load(date) {
    setLoading(true)
    const data = await fetchScheduleDay(date)
    setDay(data)
    setLoading(false)
  }

  async function loadHighlights(gameId) {
    setHighlights(h => ({ ...h, [gameId]: 'loading' }))
    const links = await fetchGameHighlights(gameId)
    setHighlights(h => ({ ...h, [gameId]: links || 'none' }))
  }

  const games = day?.games || []

  return (
    <div className="page-wrap fade-up">
      <div className="section-label">Schedule</div>

      <div style={s.dateNav}>
        <button style={s.navBtn} disabled={!day} onClick={() => load(shiftDate(day.date, -1))}>‹</button>
        <div style={s.dateLabel}>{loading ? '…' : formatDay(day?.date)}</div>
        <button style={s.navBtn} disabled={!day} onClick={() => load(shiftDate(day.date, 1))}>›</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
              <div className="skeleton skeleton-title" />
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--dim)' }}>
          No games scheduled
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger">
          {games.map(g => {
            const away = g.awayTeam || {}, home = g.homeTeam || {}
            const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT'
            const isFinal = g.gameState === 'FINAL' || g.gameState === 'OFF'
            const isFuture = !isLive && !isFinal
            const hl = highlights[g.id]

            return (
              <div key={g.id} className="card" style={{ padding: 16 }}>
                <div style={s.statusRow}>
                  <span style={{ ...s.status, color: isLive ? 'var(--red)' : 'var(--dim)' }}>
                    {isLive ? `🔴 ${g.gameState === 'CRIT' ? 'Late' : 'Live'}` : isFinal ? 'Final' : formatTime(g.startTimeUTC)}
                  </span>
                  {g.venue?.default && <span style={s.venue}>{g.venue.default}</span>}
                </div>
                <div style={s.matchup}>
                  <TeamRow team={away} score={away.score} showScore={isLive || isFinal} />
                  <TeamRow team={home} score={home.score} showScore={isLive || isFinal} />
                </div>
                {isFinal && (
                  <div style={s.hlRow}>
                    {!hl && (
                      <button style={s.hlBtn} onClick={() => loadHighlights(g.id)}>▶ Watch highlights</button>
                    )}
                    {hl === 'loading' && <span style={s.hlLoading}>Loading…</span>}
                    {hl && hl !== 'loading' && hl !== 'none' && (
                      <div style={{ display: 'flex', gap: 14 }}>
                        {hl.recap && <a href={hl.recap} target="_blank" rel="noopener noreferrer" style={s.hlLink}>▶ Recap</a>}
                        {hl.condensed && <a href={hl.condensed} target="_blank" rel="noopener noreferrer" style={s.hlLink}>▶ Condensed Game</a>}
                      </div>
                    )}
                    {hl === 'none' && <span style={s.hlLoading}>No highlights available</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamRow({ team, score, showScore }) {
  return (
    <div style={s.teamRow}>
      <div style={s.teamInfo}>
        <img src={team.darkLogo || team.logo} alt="" style={s.logo} />
        <span style={s.teamName}>{team.placeName?.default} {team.commonName?.default}</span>
      </div>
      {showScore && <span style={s.score}>{score ?? 0}</span>}
    </div>
  )
}

const s = {
  dateNav: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 18 },
  navBtn: {
    width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border2)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, minWidth: 160, textAlign: 'center' },
  statusRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  status: { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  venue: { fontSize: 11, color: 'var(--dim)' },
  matchup: { display: 'flex', flexDirection: 'column', gap: 8 },
  teamRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  teamInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { width: 28, height: 28, objectFit: 'contain' },
  teamName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 600, color: 'var(--text)' },
  score: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--red)' },
  hlRow: { marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' },
  hlBtn: {
    background: 'transparent', border: '1px solid var(--border2)', borderRadius: 7,
    padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
  },
  hlLoading: { fontSize: 12, color: 'var(--dim)' },
  hlLink: { fontSize: 12, fontWeight: 600, color: 'var(--info)', textDecoration: 'none' },
}
