import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchRoster, fetchTeamSchedule, fetchTeamNews, gamecenterUrl, getTeamXHandle, timeAgo, todayStr, fetchGameVideoIds } from '../lib/nhl.js'
import PlayerCard from '../components/PlayerCard.jsx'
import TeamTimeline from '../components/TeamTimeline.jsx'
import VideoModal from '../components/VideoModal.jsx'

export default function TeamPage() {
  const { abbrev } = useParams()
  const [roster, setRoster] = useState(null)
  const [games, setGames] = useState([])
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [openPlayerId, setOpenPlayerId] = useState(null)
  const [videoId, setVideoId] = useState(null)
  const [loadingRecapId, setLoadingRecapId] = useState(null)

  async function openRecap(game) {
    setLoadingRecapId(game.id)
    const ids = await fetchGameVideoIds(game.id)
    setLoadingRecapId(null)
    if (ids?.recap) setVideoId(ids.recap)
    else window.open(gamecenterUrl(game, game.gameDate), '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    setLoading(true)
    setNewsLoading(true)
    Promise.all([fetchRoster(abbrev), fetchTeamSchedule(abbrev)]).then(([r, g]) => {
      setRoster(r)
      setGames(g)
      setLoading(false)
    })
    fetchTeamNews(abbrev).then(n => { setNews(n); setNewsLoading(false) })
  }, [abbrev])

  const today = todayStr()
  const upcoming = games.filter(g => g.gameDate >= today && g.gameState !== 'FINAL' && g.gameState !== 'OFF').slice(0, 8)
  const recentResults = games.filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF').slice(-5).reverse()
  const teamGame = games.find(g => g.awayTeam?.abbrev === abbrev || g.homeTeam?.abbrev === abbrev)
  const teamSide = teamGame ? (teamGame.awayTeam?.abbrev === abbrev ? teamGame.awayTeam : teamGame.homeTeam) : null
  const teamName = teamSide ? `${teamSide.placeName?.default} ${teamSide.commonName?.default}` : abbrev
  const xHandle = getTeamXHandle(abbrev)

  return (
    <div className="page-wrap fade-up">
      <div style={s.header}>
        <img src={`https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`} alt="" style={s.headerLogo} />
        <div style={s.headerName}>{teamName}</div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 14 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12 }} />)}
        </div>
      ) : (
        <>
          {roster && (
            <>
              <RosterGroup title="Forwards" players={roster.forwards} onPick={setOpenPlayerId} />
              <RosterGroup title="Defensemen" players={roster.defensemen} onPick={setOpenPlayerId} />
              <RosterGroup title="Goalies" players={roster.goalies} onPick={setOpenPlayerId} />
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 20 }}>Upcoming</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }} className="stagger">
                {upcoming.map(g => {
                  const isHome = g.homeTeam?.abbrev === abbrev
                  const opp = isHome ? g.awayTeam : g.homeTeam
                  return (
                    <div key={g.id} className="card" style={s.gameRow}>
                      <span style={s.gameDate}>{new Date(`${g.gameDate}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                      <span style={{ ...s.haBadge, ...(isHome ? s.haHome : s.haAway) }}>{isHome ? 'HOME' : 'AWAY'}</span>
                      <div style={s.gameOpp}>
                        {opp?.logo && <img src={opp.darkLogo || opp.logo} alt="" style={s.oppLogo} />}
                        <span>{isHome ? 'vs' : '@'} {opp?.commonName?.default}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {recentResults.length > 0 && (
            <>
              <div className="section-label">Recent Results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }} className="stagger">
                {recentResults.map(g => {
                  const isHome = g.homeTeam?.abbrev === abbrev
                  const opp = isHome ? g.awayTeam : g.homeTeam
                  const us = isHome ? g.homeTeam : g.awayTeam
                  return (
                    <button key={g.id} className="hover-lift" style={s.resultRow} onClick={() => openRecap(g)} disabled={loadingRecapId === g.id}>
                      <span style={s.gameDate}>{new Date(`${g.gameDate}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                      <span style={{ ...s.haBadge, ...(isHome ? s.haHome : s.haAway) }}>{isHome ? 'HOME' : 'AWAY'}</span>
                      <div style={s.gameOpp}>
                        {opp?.logo && <img src={opp.darkLogo || opp.logo} alt="" style={s.oppLogo} />}
                        <span>{isHome ? 'vs' : '@'} {opp?.commonName?.default}</span>
                        <span style={s.resultScore}>{us?.score}-{opp?.score}</span>
                      </div>
                      <span style={s.watchLink}>{loadingRecapId === g.id ? 'Loading…' : '▶ Recap'}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {(newsLoading || news.length > 0) && (
        <>
          <div className="section-label">Team News</div>
          {newsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {[0, 1].map(i => (
                <div key={i} className="card" style={{ padding: 14 }}>
                  <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: 10 }} />
                  <div className="skeleton skeleton-text" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }} className="stagger">
              {news.map((a, i) => (
                <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="hover-lift" style={s.newsItem}>
                  <div style={{ flex: 1 }}>
                    <div style={s.newsSrc}>{a.source}</div>
                    <div style={s.newsTitle}>{a.headline}</div>
                    {a.published && <div style={s.newsMeta}>{timeAgo(a.published)}</div>}
                  </div>
                  <div style={s.newsArrow}>›</div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {xHandle && (
        <>
          <div className="section-label">Social</div>
          <TeamTimeline key={abbrev} handle={xHandle} />
        </>
      )}

      {openPlayerId && <PlayerCard playerId={openPlayerId} onClose={() => setOpenPlayerId(null)} />}
      {videoId && <VideoModal videoId={videoId} onClose={() => setVideoId(null)} />}
    </div>
  )
}

function RosterGroup({ title, players, onPick }) {
  if (!players?.length) return null
  return (
    <>
      <div className="section-label" style={{ marginTop: 20 }}>{title}</div>
      <div style={s.rosterGrid} className="stagger">
        {players.map(p => (
          <div key={p.id} className="card hover-lift" style={s.playerCard} onClick={() => onPick(p.id)}>
            <img src={p.headshot} alt="" style={s.headshot} onError={e => { e.target.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0 }}>
              <div style={s.playerName}>{p.firstName?.default} {p.lastName?.default}</div>
              <div style={s.playerSub}>#{p.sweaterNumber} · {p.positionCode}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  headerLogo: { width: 56, height: 56, objectFit: 'contain' },
  headerName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--text)' },
  gameRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' },
  gameDate: { fontSize: 12, color: 'var(--dim)', width: 60, flexShrink: 0 },
  haBadge: { fontSize: 9, fontWeight: 700, letterSpacing: 0.5, borderRadius: 4, padding: '2px 6px', flexShrink: 0 },
  haHome: { color: 'var(--ice)', background: 'rgba(45,226,230,0.12)' },
  haAway: { color: 'var(--dim)', background: 'var(--surface2)' },
  gameOpp: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)', fontWeight: 600 },
  oppLogo: { width: 20, height: 20, objectFit: 'contain' },
  rosterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 },
  playerCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' },
  resultRow: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    textDecoration: 'none', color: 'inherit', font: 'inherit', textAlign: 'left',
  },
  resultScore: { color: 'var(--red)', fontWeight: 700, marginLeft: 4 },
  watchLink: { fontSize: 12, fontWeight: 600, color: 'var(--info)', marginLeft: 'auto', flexShrink: 0 },
  newsItem: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    textDecoration: 'none', color: 'inherit',
  },
  newsSrc: { fontSize: 10, color: 'var(--red)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  newsTitle: { fontSize: 14, color: 'var(--text)', lineHeight: 1.45 },
  newsMeta: { fontSize: 12, color: 'var(--dim)', marginTop: 4 },
  newsArrow: { fontSize: 18, color: 'var(--dim)', marginLeft: 4, flexShrink: 0 },
  headshot: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface2)', flexShrink: 0 },
  playerName: { fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  playerSub: { fontSize: 11, color: 'var(--dim)' },
}
