import { useState } from 'react'
import { searchPlayers } from '../lib/nhl.js'
import PlayerCard from '../components/PlayerCard.jsx'

function formatSeason(id) {
  if (!id) return null
  const s = String(id)
  return `${s.slice(0, 4)}-${s.slice(6, 8)}`
}

export default function PlayerSearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [openPlayerId, setOpenPlayerId] = useState(null)

  async function runSearch(q) {
    setQuery(q)
    if (!q || q.trim().length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    const data = await searchPlayers(q)
    setResults(data)
    setLoading(false)
    setSearched(true)
  }

  return (
    <div className="page-wrap fade-up">
      <div className="section-label">Player Search</div>

      <input
        style={s.input}
        type="text"
        placeholder="Search any player, active or retired — try 'Gretzky'"
        value={query}
        onChange={e => runSearch(e.target.value)}
        autoFocus
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }} className="stagger">
          {results.map(p => (
            <div key={p.playerId} className="card hover-lift" style={s.row} onClick={() => setOpenPlayerId(p.playerId)}>
              <div style={{ minWidth: 0 }}>
                <div style={s.name}>{p.name}</div>
                <div style={s.sub}>
                  {p.positionCode}
                  {p.active
                    ? ` · ${p.teamAbbrev || '—'}`
                    : p.lastTeamAbbrev ? ` · Last played ${p.lastTeamAbbrev}${formatSeason(p.lastSeasonId) ? ` (${formatSeason(p.lastSeasonId)})` : ''}` : ''}
                </div>
              </div>
              <span style={{ ...s.badge, ...(p.active ? s.badgeActive : s.badgeRetired) }}>
                {p.active ? 'Active' : 'Retired'}
              </span>
            </div>
          ))}
          {searched && results.length === 0 && (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--dim)' }}>
              No players found for "{query}"
            </div>
          )}
        </div>
      )}

      {openPlayerId && <PlayerCard playerId={openPlayerId} onClose={() => setOpenPlayerId(null)} />}
    </div>
  )
}

const s = {
  input: {
    width: '100%', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 10, color: 'var(--text)', fontSize: 15, outline: 'none',
  },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' },
  name: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 700, color: 'var(--text)' },
  sub: { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  badge: { fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', borderRadius: 20, padding: '4px 10px', flexShrink: 0 },
  badgeActive: { color: 'var(--success)', background: 'rgba(47,190,143,0.12)', border: '1px solid rgba(47,190,143,0.3)' },
  badgeRetired: { color: 'var(--dim)', background: 'var(--surface2)', border: '1px solid var(--border2)' },
}
