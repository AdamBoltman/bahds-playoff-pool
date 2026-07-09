import { useEffect, useState } from 'react'
import { fetchStandings } from '../lib/nhl.js'

export default function StandingsPage() {
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [conf, setConf] = useState('W')

  useEffect(() => {
    fetchStandings().then(data => { setStandings(data); setLoading(false) })
  }, [])

  const rows = standings
    .filter(t => t.conferenceAbbrev === conf)
    .sort((a, b) => a.conferenceSequence - b.conferenceSequence)

  const confName = rows[0]?.conferenceName || (conf === 'E' ? 'Eastern' : 'Western')

  return (
    <div className="page-wrap fade-up">
      <div className="section-label">League Standings</div>

      <div style={s.tabs}>
        {['W', 'E'].map(c => (
          <button key={c} style={{ ...s.tab, ...(conf === c ? s.tabActive : {}) }} onClick={() => setConf(c)}>
            {c === 'W' ? 'Western' : 'Eastern'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 14 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 14 }} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={{ ...s.th, textAlign: 'left' }}>{confName}</th>
                <th style={s.th}>GP</th>
                <th style={s.th}>W</th>
                <th style={s.th}>L</th>
                <th style={s.th}>OTL</th>
                <th style={s.th}>PTS</th>
                <th style={s.th}>L10</th>
                <th style={s.th}>STRK</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={t.teamAbbrev?.default} style={i === 7 ? s.wildcardLine : undefined}>
                  <td style={{ ...s.td, color: 'var(--dim)' }}>{t.conferenceSequence}</td>
                  <td style={{ ...s.td, textAlign: 'left' }}>
                    <div style={s.teamCell}>
                      <img src={t.teamLogo} alt="" style={s.logo} />
                      <div>
                        <div style={s.teamName}>{t.teamCommonName?.default}</div>
                        <div style={s.teamSub}>{t.divisionName}{t.clinchIndicator ? ` · clinched` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>{t.gamesPlayed}</td>
                  <td style={s.td}>{t.wins}</td>
                  <td style={s.td}>{t.losses}</td>
                  <td style={s.td}>{t.otLosses}</td>
                  <td style={{ ...s.td, fontWeight: 700, color: 'var(--text)' }}>{t.points}</td>
                  <td style={s.td}>{t.l10Wins}-{t.l10Losses}-{t.l10OtLosses}</td>
                  <td style={s.td}>{t.streakCode}{t.streakCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && (
            <div style={s.wildcardNote}>Top 8 make the playoffs — line shown after the cutoff</div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border2)',
    background: 'var(--surface)', color: 'var(--muted)',
    fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700,
    letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
  },
  tabActive: { background: 'var(--red)', borderColor: 'var(--red)', color: 'white' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 },
  th: {
    padding: '10px 8px', textAlign: 'center', color: 'var(--dim)',
    fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)', fontWeight: 700,
  },
  td: { padding: '9px 8px', textAlign: 'center', color: 'var(--muted)', borderBottom: '1px solid var(--border)' },
  wildcardLine: { boxShadow: 'inset 0 1px 0 var(--red)' },
  wildcardNote: { fontSize: 11, color: 'var(--dim)', padding: '10px 14px' },
  teamCell: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { width: 26, height: 26, objectFit: 'contain', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  teamSub: { fontSize: 11, color: 'var(--dim)' },
}
