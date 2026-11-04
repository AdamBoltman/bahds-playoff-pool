import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchPlayerLanding, fetchOpponentSplits } from '../lib/nhl.js'

function formatTOI(avgToi) {
  if (!avgToi) return '—'
  // avgToi arrives as "MM:SS" string
  if (typeof avgToi === 'string') return avgToi.slice(0, 5)
  const m = Math.floor(avgToi / 60)
  const s = Math.floor(avgToi % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PlayerCard({ playerId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSplits, setShowSplits] = useState(false)
  const [splits, setSplits] = useState(null)
  const [splitsLoading, setSplitsLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setShowSplits(false); setSplits(null)
    fetchPlayerLanding(playerId).then(d => { setData(d); setLoading(false) })
  }, [playerId])

  async function toggleSplits() {
    if (!showSplits && !splits) {
      setSplitsLoading(true)
      const result = await fetchOpponentSplits(playerId, data.seasonTotals)
      setSplits(result)
      setSplitsLoading(false)
    }
    setShowSplits(v => !v)
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isGoalie = data?.position === 'G'
  const season = data?.featuredStats?.regularSeason?.subSeason
  const career = data?.careerTotals?.regularSeason
  const last5 = data?.last5Games || []
  const lastTeamAbbrev = data?.last5Games?.[0]?.teamAbbrev
  const teamLogoUrl = data?.teamLogo || (lastTeamAbbrev ? `https://assets.nhle.com/logos/nhl/svg/${lastTeamAbbrev}_light.svg` : null)
  const teamLabel = data?.fullTeamName?.default || (lastTeamAbbrev ? `Last played ${lastTeamAbbrev}` : null)

  // Build season label from featured stats season id e.g. 20262027 → "2026-27"
  const seasonId = data?.featuredStats?.season
  const seasonLabel = seasonId
    ? `${String(seasonId).slice(0, 4)}-${String(seasonId).slice(6, 8)} Regular Season`
    : 'Current Season'

  const shootingPct = season?.shootingPctg != null
    ? `${(season.shootingPctg * 100).toFixed(1)}%`
    : '—'

  const plusMinusStr = season?.plusMinus != null
    ? (season.plusMinus > 0 ? `+${season.plusMinus}` : String(season.plusMinus))
    : '—'

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
            {/* ── Banner ── */}
            <div style={{ ...s.banner, backgroundImage: `url(${data.heroImage})` }}>
              <div style={s.bannerScrim} />
              <button style={s.closeBtn} onClick={onClose}>✕</button>
              <div style={s.bannerContent}>
                <div style={s.bannerLeft}>
                  {teamLogoUrl && <img src={teamLogoUrl} alt="" style={s.teamLogo} />}
                  <div>
                    <div style={s.firstName}>{data.firstName?.default}</div>
                    <div style={s.lastName}>{data.lastName?.default}</div>
                    <div style={s.sub}>
                      {teamLabel ? `${teamLabel} · ` : ''}
                      {isGoalie ? 'G' : data.position} #{data.sweaterNumber}
                      {data.heightInInches ? ` · ${Math.floor(data.heightInInches / 12)}'${data.heightInInches % 12}"` : ''}
                      {data.weightInPounds ? ` · ${data.weightInPounds} lbs` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 0 4px' }}>

              {/* ── Season summary row ── */}
              {season && (
                <div style={s.summaryRow}>
                  <span style={s.summaryLabel}>{seasonLabel}</span>
                  <div style={s.summaryStats}>
                    <span style={s.summaryItem}><b>{season.gamesPlayed ?? '—'}</b> GP</span>
                    {isGoalie ? (
                      <>
                        <span style={s.summaryItem}><b>{season.wins ?? '—'}</b> W</span>
                        <span style={s.summaryItem}><b>{season.losses ?? '—'}</b> L</span>
                        <span style={s.summaryItem}><b>{season.otLosses ?? '—'}</b> OT</span>
                      </>
                    ) : (
                      <>
                        <span style={s.summaryItem}><b>{season.goals ?? '—'}</b> G</span>
                        <span style={s.summaryItem}><b>{season.assists ?? '—'}</b> A</span>
                        <span style={s.summaryItem}><b>{season.points ?? '—'}</b> P</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Stat boxes ── */}
              <div style={{ padding: '0 16px 16px' }}>
                {isGoalie ? (
                  <div style={s.statGrid}>
                    <StatBox label="GAA" value={season ? Number(season.goalsAgainstAvg).toFixed(2) : '—'} />
                    <StatBox label="SV%" value={season ? Number(season.savePctg).toFixed(3) : '—'} />
                    <StatBox label="Shutouts" value={season?.shutouts ?? '—'} />
                    <StatBox label="Saves" value={season?.saves ?? '—'} />
                    <StatBox label="SA" value={season?.shotsAgainst ?? '—'} />
                    <StatBox label="TOI/G" value={season?.timeOnIce ? formatTOI(Math.round(season.timeOnIce / (season.gamesPlayed || 1))) : '—'} />
                  </div>
                ) : (
                  <>
                    <div style={s.statGrid}>
                      <StatBox label="Goals" value={season?.goals ?? '—'} accent />
                      <StatBox label="Assists" value={season?.assists ?? '—'} />
                      <StatBox label="Points" value={season?.points ?? '—'} />
                      <StatBox label="+/-" value={plusMinusStr} signed />
                    </div>
                    <div style={{ ...s.statGrid, marginTop: 6 }}>
                      <StatBox label="TOI/G" value={formatTOI(season?.avgToi)} />
                      <StatBox label="Shots" value={season?.shots ?? '—'} />
                      <StatBox label="SH%" value={shootingPct} />
                      <StatBox label="PP Goals" value={season?.powerPlayGoals ?? '—'} />
                    </div>
                  </>
                )}

                {/* Career line */}
                {career && (
                  <div style={s.careerRow}>
                    Career · {career.gamesPlayed} GP
                    {isGoalie
                      ? ` · ${career.wins}-${career.losses}-${career.otLosses} · ${Number(career.goalsAgainstAvg).toFixed(2)} GAA · ${Number(career.savePctg).toFixed(3)} SV%`
                      : ` · ${career.goals}G ${career.assists}A ${career.points} PTS`}
                  </div>
                )}

                {/* Badges */}
                {data.badges?.length > 0 && (
                  <div style={s.badgeRow}>
                    {data.badges.map((b, i) => (
                      <span key={i} style={s.badge}>{b.title?.default || b.title}</span>
                    ))}
                  </div>
                )}

                {/* Last 5 games */}
                {last5.length > 0 && (
                  <>
                    <div style={s.sectionHead}>Last 5 Games</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {last5.map(g => (
                        <div key={g.gameId} style={s.gameRow}>
                          <span style={s.gameOpp}>{g.homeRoadFlag === 'H' ? 'vs' : '@'} {g.opponentAbbrev}</span>
                          <span style={s.gameDate}>{g.gameDate?.slice(5)}</span>
                          {isGoalie ? (
                            <span style={s.gameLine}>
                              <span style={{ color: g.decision === 'W' ? 'var(--success)' : 'var(--red)', fontWeight: 700 }}>{g.decision}</span>
                              {' '}· {g.goalsAgainst} GA · {Number(g.savePctg).toFixed(3)} SV%
                            </span>
                          ) : (
                            <span style={s.gameLine}>{g.goals}G {g.assists}A · <b>{g.points}PTS</b></span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Career vs opponent */}
                {!isGoalie && (
                  <>
                    <button style={s.splitsBtn} onClick={toggleSplits}>
                      {showSplits ? '▾' : '▸'} Career vs opponent
                    </button>
                    {showSplits && (
                      splitsLoading ? (
                        <div style={{ padding: '12px 0' }}>
                          <div className="skeleton skeleton-text" />
                          <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                        </div>
                      ) : (
                        <div style={s.splitsTable}>
                          <div style={s.splitsHeader}>
                            <span style={{ flex: 1 }}>Team</span>
                            <span style={s.splitsCol}>GP</span>
                            <span style={s.splitsCol}>G</span>
                            <span style={s.splitsCol}>A</span>
                            <span style={s.splitsCol}>PTS</span>
                          </div>
                          {splits?.map(row => (
                            <div key={row.opponent} style={s.splitsRow}>
                              <span style={s.splitsTeam}>
                                <img src={`https://assets.nhle.com/logos/nhl/svg/${row.opponent}_dark.svg`} alt="" style={s.splitsLogo} />
                                {row.opponent}
                              </span>
                              <span style={s.splitsCol}>{row.gamesPlayed}</span>
                              <span style={s.splitsCol}>{row.goals}</span>
                              <span style={s.splitsCol}>{row.assists}</span>
                              <span style={{ ...s.splitsCol, color: 'var(--ice)', fontWeight: 700 }}>{row.points}</span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

function StatBox({ label, value, accent, signed }) {
  const isNeg = signed && typeof value === 'string' && value.startsWith('-')
  const isPos = signed && typeof value === 'string' && value.startsWith('+')
  return (
    <div style={s.statBox}>
      <div style={{
        ...s.statValue,
        ...(accent ? { color: '#C8102E' } : {}),
        ...(isNeg ? { color: '#FF4466' } : {}),
        ...(isPos ? { color: '#2FBE8F' } : {}),
      }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  )
}

const s = {
  banner: {
    height: 180, backgroundSize: 'cover', backgroundPosition: 'center 20%',
    position: 'relative', borderRadius: '18px 18px 0 0', overflow: 'hidden',
  },
  bannerScrim: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, rgba(15,17,23,0.1) 0%, rgba(15,17,23,0.97) 100%)',
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
  bannerContent: { position: 'absolute', left: 18, bottom: 14, right: 18 },
  bannerLeft: { display: 'flex', alignItems: 'flex-end', gap: 12 },
  teamLogo: { width: 32, height: 32, objectFit: 'contain', marginBottom: 4, flexShrink: 0 },
  firstName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.75)', lineHeight: 1.1 },
  lastName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: 0.3 },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 },

  // Season summary bar
  summaryRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: 'rgba(0,0,0,0.25)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  summaryLabel: { fontSize: 11, fontWeight: 700, color: '#5B6A7A', letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" },
  summaryStats: { display: 'flex', gap: 16 },
  summaryItem: { fontSize: 12, color: '#9CAAB8' },

  // Stat boxes
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 14 },
  statBox: { textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 4px', border: '1px solid rgba(255,255,255,0.06)' },
  statValue: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: '#E8EEF4' },
  statLabel: { fontSize: 9, fontWeight: 700, color: '#4B6072', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3 },

  sectionHead: { fontSize: 10, fontWeight: 800, color: '#5B6A7A', letterSpacing: 1.5, textTransform: 'uppercase', margin: '18px 0 8px', fontFamily: "'Barlow Condensed', sans-serif" },
  careerRow: { fontSize: 11, color: '#5B6A7A', marginTop: 10, lineHeight: 1.5 },
  badgeRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: {
    fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.25)', borderRadius: 20, padding: '3px 10px',
  },

  // Last 5 games
  gameRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 12, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  gameOpp: { color: '#C8D0D9', fontWeight: 600, minWidth: 60 },
  gameDate: { fontSize: 10, color: '#4B6072', flex: 1 },
  gameLine: { color: '#9CAAB8', textAlign: 'right' },

  // Splits
  splitsBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#9CAAB8', cursor: 'pointer',
    marginTop: 14, width: '100%', textAlign: 'left',
  },
  splitsTable: { marginTop: 10, maxHeight: 220, overflowY: 'auto' },
  splitsHeader: {
    display: 'flex', fontSize: 10, color: '#4B6072', letterSpacing: 0.5, textTransform: 'uppercase',
    padding: '0 0 6px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  splitsRow: {
    display: 'flex', alignItems: 'center', fontSize: 12, color: '#9CAAB8',
    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  splitsTeam: { flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: '#C8D0D9', fontWeight: 600 },
  splitsLogo: { width: 16, height: 16, objectFit: 'contain' },
  splitsCol: { width: 34, textAlign: 'center', flexShrink: 0 },
}
