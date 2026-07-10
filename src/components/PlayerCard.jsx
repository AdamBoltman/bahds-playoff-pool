import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchPlayerLanding } from '../lib/nhl.js'

export default function PlayerCard({ playerId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPlayerLanding(playerId).then(d => { setData(d); setLoading(false) })
  }, [playerId])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isGoalie = data?.position === 'G'
  const season = data?.featuredStats?.regularSeason?.subSeason
  const career = data?.careerTotals?.regularSeason
  const last5 = data?.last5Games || []

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 160, marginBottom: 16, borderRadius: 12 }} />
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          </div>
        ) : !data ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <div style={{ color: 'var(--dim)', marginBottom: 16 }}>Couldn't load this player.</div>
            <button style={s.closeBtnAlt} onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ ...s.banner, backgroundImage: `url(${data.heroImage})` }}>
              <div style={s.bannerScrim} />
              <button style={s.closeBtn} onClick={onClose}>✕</button>
              <div style={s.bannerContent}>
                <img src={data.teamLogo} alt="" style={s.teamLogo} />
                <div style={s.name}>{data.firstName?.default} {data.lastName?.default}</div>
                <div style={s.sub}>{data.fullTeamName?.default} · {isGoalie ? 'Goalie' : data.position} #{data.sweaterNumber}</div>
              </div>
            </div>

            <div style={{ padding: '18px 20px' }}>
              <div style={s.statGrid}>
                {isGoalie ? (
                  <>
                    <Stat label="Record" value={season ? `${season.wins}-${season.losses}-${season.otLosses}` : '—'} />
                    <Stat label="GAA" value={season ? Number(season.goalsAgainstAvg).toFixed(2) : '—'} />
                    <Stat label="SV%" value={season ? Number(season.savePctg).toFixed(3) : '—'} />
                    <Stat label="Shutouts" value={season?.shutouts ?? '—'} />
                  </>
                ) : (
                  <>
                    <Stat label="Goals" value={season?.goals ?? '—'} />
                    <Stat label="Assists" value={season?.assists ?? '—'} />
                    <Stat label="Points" value={season?.points ?? '—'} />
                    <Stat label="+/-" value={season?.plusMinus ?? '—'} />
                  </>
                )}
              </div>
              <div style={s.seasonLabel}>2025-26 Season</div>

              {career && (
                <div style={s.careerRow}>
                  Career: {career.gamesPlayed} GP
                  {isGoalie
                    ? ` · ${career.wins}-${career.losses}-${career.otLosses} · ${Number(career.goalsAgainstAvg).toFixed(2)} GAA`
                    : ` · ${career.goals}G ${career.assists}A ${career.points}PTS`}
                </div>
              )}

              {data.badges?.length > 0 && (
                <div style={s.badgeRow}>
                  {data.badges.map((b, i) => (
                    <span key={i} style={s.badge}>{b.title?.default || b.title}</span>
                  ))}
                </div>
              )}

              {last5.length > 0 && (
                <>
                  <div style={s.seasonLabel}>Last 5 Games</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {last5.map(g => (
                      <div key={g.gameId} style={s.gameRow}>
                        <span style={s.gameOpp}>{g.homeRoadFlag === 'H' ? 'vs' : '@'} {g.opponentAbbrev}</span>
                        {isGoalie ? (
                          <span style={s.gameLine}>
                            <span style={{ color: g.decision === 'W' ? 'var(--success)' : 'var(--red)', fontWeight: 700 }}>{g.decision}</span>
                            {' '}· {g.goalsAgainst} GA · {Number(g.savePctg).toFixed(3)} SV%
                          </span>
                        ) : (
                          <span style={s.gameLine}>{g.goals}G {g.assists}A · {g.points} PTS</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

function Stat({ label, value }) {
  return (
    <div style={s.statBox}>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  )
}

const s = {
  banner: {
    height: 170, backgroundSize: 'cover', backgroundPosition: 'center 20%',
    position: 'relative', borderRadius: '18px 18px 0 0', overflow: 'hidden',
  },
  bannerScrim: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, rgba(15,17,23,0.15) 0%, rgba(15,17,23,0.95) 100%)',
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: '50%',
    background: 'rgba(15,17,23,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: 'white',
    fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  closeBtnAlt: {
    padding: '8px 20px', background: 'var(--red)', color: 'white', border: 'none',
    borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  bannerContent: { position: 'absolute', left: 18, bottom: 12, right: 18 },
  teamLogo: { width: 28, height: 28, objectFit: 'contain', marginBottom: 6 },
  name: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 },
  sub: { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 },
  statBox: { textAlign: 'center', background: 'var(--surface2)', borderRadius: 10, padding: '10px 6px' },
  statValue: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, color: 'var(--ice)' },
  statLabel: { fontSize: 10, color: 'var(--dim)', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  seasonLabel: { fontSize: 11, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase', margin: '16px 0 8px' },
  careerRow: { fontSize: 12, color: 'var(--muted)' },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: {
    fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.25)', borderRadius: 20, padding: '3px 10px',
  },
  gameRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)',
  },
  gameOpp: { color: 'var(--muted)', fontWeight: 600 },
  gameLine: { color: 'var(--text)' },
}
