import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import {
  fetchSkaterLeaders, fetchGoalieLeaders, fetchESPNNews, timeAgo,
  isPlayoffs, fetchScheduleDay, shiftDate, todayStr, gamecenterUrl, playerHeadshot,
  fetchStandings, fetchSeasonInfo, fetchPlayerLanding, fetchGameVideoIds,
} from '../lib/nhl.js'
import { useAuth } from '../hooks/useAuth.jsx'
import PlayerCard from '../components/PlayerCard.jsx'
import VideoModal from '../components/VideoModal.jsx'

export default function HomePage() {
  const { user, isAdmin } = useAuth()
  const playoffs = isPlayoffs()
  const [leader, setLeader] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [myPts, setMyPts] = useState(null)
  const [isTied, setIsTied] = useState(false)
  const [playerCount, setPlayerCount] = useState(null)
  const [leaders, setLeaders] = useState(null)
  const [goalies, setGoalies] = useState([])
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [today, setToday] = useState(null)
  const [lastNight, setLastNight] = useState(null)
  const [seasonInfo, setSeasonInfo] = useState(null)
  const [divisionLeaders, setDivisionLeaders] = useState([])
  const [commNote, setCommNote] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [spotlight, setSpotlight] = useState(null)
  const [openPlayerId, setOpenPlayerId] = useState(null)
  const [videoId, setVideoId] = useState(null)
  const [loadingRecapId, setLoadingRecapId] = useState(null)

  useEffect(() => {
    if (playoffs) loadLeaderboard()
    loadStats()
    loadNews()
    loadGames()
    loadCommNote()
    loadStandingsSnapshot()
  }, [])

  async function loadLeaderboard() {
    const { data } = await supabase.from('scores').select('user_id, display_name, total').order('total', { ascending: false })
    if (!data?.length) return
    setLeader(data[0])
    setPlayerCount(data.length)
    const idx = data.findIndex(r => r.user_id === user?.id)
    if (idx >= 0) {
      const myTotal = data[idx].total
      const rank = data.filter(r => r.total > myTotal).length + 1
      const tied = data.filter(r => r.total === myTotal).length > 1
      setMyRank(rank)
      setMyPts(myTotal)
      setIsTied(tied)
    }
  }

  async function loadStats() {
    setStatsLoading(true)
    const [s, g] = await Promise.all([fetchSkaterLeaders(5), fetchGoalieLeaders(5)])
    setLeaders(s)
    setGoalies(g)
    setStatsLoading(false)
    const topId = s?.points?.[0]?.playerId
    if (topId) fetchPlayerLanding(topId).then(setSpotlight)
  }

  async function loadNews() {
    const articles = await fetchESPNNews()
    setNews(articles.length ? articles : FALLBACK_NEWS)
    setNewsLoading(false)
  }

  async function loadGames() {
    const t = todayStr()
    const [t0, y0, season] = await Promise.all([fetchScheduleDay(t), fetchScheduleDay(shiftDate(t, -1)), fetchSeasonInfo()])
    setToday(t0)
    setLastNight(y0)
    setSeasonInfo(season)
  }

  async function openRecap(game) {
    setLoadingRecapId(game.id)
    const ids = await fetchGameVideoIds(game.id)
    setLoadingRecapId(null)
    if (ids?.recap) setVideoId(ids.recap)
    else window.open(gamecenterUrl(game, lastNight.date), '_blank', 'noopener,noreferrer')
  }

  async function loadStandingsSnapshot() {
    const data = await fetchStandings()
    setDivisionLeaders(data.filter(t => t.divisionSequence === 1).sort((a, b) => b.points - a.points))
  }

  async function loadCommNote() {
    const { data } = await supabase.from('commissioner_note').select('note').eq('id', 1).maybeSingle()
    if (data?.note) setCommNote(data.note)
  }

  async function saveNote() {
    setSavingNote(true)
    await supabase.from('commissioner_note').upsert({ id: 1, note: noteInput })
    setCommNote(noteInput); setSavingNote(false); setEditingNote(false)
  }

  const behindBy = leader && myPts != null ? leader.total - myPts : null
  const isLeading = behindBy === 0 && myRank === 1
  const todayGames = today?.games || []
  const finishedLastNight = (lastNight?.games || []).filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF')

  const daysToSeason = seasonInfo?.regularSeasonStartDate
    ? Math.ceil((new Date(`${seasonInfo.regularSeasonStartDate}T00:00:00Z`) - new Date()) / 86400000)
    : null
  const showSeasonBanner = !playoffs && todayGames.length === 0 && finishedLastNight.length === 0

  return (
    <div className="page-wrap fade-up">

      {/* Commissioner Note */}
      {(commNote || isAdmin) && (
        <div style={s.commCard}>
          <div style={s.commHeader}>
            <span style={s.commLabel}>📣 Commissioner</span>
            {isAdmin && !editingNote && (
              <button style={s.editBtn} onClick={() => { setNoteInput(commNote); setEditingNote(true) }}>Edit</button>
            )}
          </div>
          {editingNote ? (
            <div>
              <textarea style={s.noteInput} value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3} placeholder="Post a message to the pool..." autoFocus />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button style={s.saveNoteBtn} onClick={saveNote} disabled={savingNote}>{savingNote ? '...' : 'Post'}</button>
                <button style={s.cancelBtn} onClick={() => setEditingNote(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={s.commText}>{commNote || <span style={{ color: 'var(--dim)', fontStyle: 'italic', fontSize: 13 }}>No message yet — click Edit to post one.</span>}</div>
          )}
        </div>
      )}

      {/* Pool leader — playoffs only */}
      {playoffs && (leader ? (
        <>
          <div className="section-label">Pool Leader</div>
          <div style={{ ...s.hero, animation: 'slideUp 0.4s ease both' }}>
            <div>
              <div style={s.heroSub}>Leading the pool</div>
              <div style={{ ...s.heroName, animation: isLeading ? 'glow 2s infinite' : 'none' }}>
                {leader.display_name || 'Pool Leader'}
              </div>
              <div style={s.heroPts}>{leader.total} pts total</div>
            </div>
            {myRank && (
              <div style={s.heroRight}>
                <div style={s.heroSub}>Your rank</div>
                <div style={s.heroRank}>
                  {isTied ? 'T-' : '#'}{myRank}
                  <span style={{ fontSize: 16, color: 'var(--dim)' }}> of {playerCount}</span>
                </div>
                {behindBy > 0 && <div style={s.heroPts}>{behindBy} pts back</div>}
                {isLeading && <div style={{ fontSize: 13, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>🏒 You're leading!</div>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={s.emptyHero}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏒</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Pool hasn't started yet</div>
          <div style={{ fontSize: 13, color: 'var(--dim)' }}>Standings will appear here once picks are submitted</div>
        </div>
      ))}

      {/* Spotlight — points leader, the year-round visual anchor */}
      {!playoffs && spotlight && (
        <div style={{ ...s.spotlight, backgroundImage: `url(${spotlight.heroImage})` }} className="hover-lift"
          onClick={() => setOpenPlayerId(spotlight.playerId)}>
          <div style={s.spotlightScrim} />
          <div style={s.spotlightContent}>
            <div style={s.spotlightTag}>🏒 League Points Leader</div>
            <div style={s.spotlightName}>{spotlight.firstName?.default} {spotlight.lastName?.default}</div>
            <div style={s.spotlightSub}>
              {spotlight.fullTeamName?.default} · {spotlight.featuredStats?.regularSeason?.subSeason?.points} PTS
              ({spotlight.featuredStats?.regularSeason?.subSeason?.goals}G {spotlight.featuredStats?.regularSeason?.subSeason?.assists}A)
            </div>
            <div style={s.spotlightHint}>Tap for player card ›</div>
          </div>
        </div>
      )}

      {/* Season countdown — shown only in the true off-season */}
      {showSeasonBanner && (
        <div style={s.seasonBanner}>
          {daysToSeason > 0 ? (
            <>🏒 Puck drop in <strong>{daysToSeason} day{daysToSeason === 1 ? '' : 's'}</strong> — regular season starts {new Date(`${seasonInfo.regularSeasonStartDate}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' })}</>
          ) : (
            <>🏒 Off-season — the schedule for next season isn't out yet. Check back this fall.</>
          )}
        </div>
      )}

      <div className="home-grid">
        <div className="home-main">

          {/* Stat leaders */}
          <div className="section-label">
            {leaders?.isPlayoffs ? 'Playoff leaders' : 'Regular season leaders'}
          </div>
          {statsLoading ? (
            <div className="leader-grid">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="card" style={{ padding: 14 }}>
                  <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-text" style={{ width: '45%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="leader-grid stagger">
              <LeaderCard label="Goals" players={leaders?.goals} unit="G" accent="var(--red)" onPick={setOpenPlayerId} />
              <LeaderCard label="Points" players={leaders?.points} unit="PTS" accent="var(--info)" onPick={setOpenPlayerId} />
              <LeaderCard label="Assists" players={leaders?.assists} unit="A" accent="var(--info)" onPick={setOpenPlayerId} />
              <LeaderCard label="GAA" players={goalies} unit="GAA" accent="var(--success)" decimals={2} onPick={setOpenPlayerId} />
            </div>
          )}

          {/* Division leaders snapshot */}
          {divisionLeaders.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>Division Leaders</div>
              <div style={s.divGrid} className="stagger">
                {divisionLeaders.map(t => {
                  const maxPts = Math.max(...divisionLeaders.map(d => d.points))
                  return (
                    <div key={t.teamAbbrev?.default} className="card" style={{ padding: '10px 14px' }}>
                      <div style={s.divCard}>
                        <img src={t.teamLogo} alt="" style={s.divLogo} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={s.divName}>{t.teamCommonName?.default}</div>
                          <div style={s.divSub}>{t.divisionName}</div>
                        </div>
                        <div style={s.divPts}>{t.points}<span style={s.divPtsLabel}>PTS</span></div>
                      </div>
                      <div className="pace-track">
                        <div className="pace-fill" style={{ width: `${(t.points / maxPts) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <Link to="/standings" style={s.seeMore}>See full standings ›</Link>
            </>
          )}

          {/* Today's games */}
          {todayGames.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>Today</div>
              <div style={s.gamesGrid} className="stagger">
                {todayGames.map(g => {
                  const home = g.homeTeam || {}, away = g.awayTeam || {}
                  const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT'
                  const isFinal = g.gameState === 'FINAL' || g.gameState === 'OFF'
                  return (
                    <div key={g.id} className="card" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: isLive ? 'var(--red)' : 'var(--dim)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                          {isLive ? '🔴 LIVE' : isFinal ? 'Final' : 'Upcoming'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          {away.logo && <img src={away.darkLogo || away.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', marginBottom: 2 }} />}
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{away.abbrev || '—'}</div>
                          {(isLive || isFinal) && <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{away.score ?? ''}</div>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--dim)' }}>@</div>
                        <div style={{ textAlign: 'center' }}>
                          {home.logo && <img src={home.darkLogo || home.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', marginBottom: 2 }} />}
                          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{home.abbrev || '—'}</div>
                          {(isLive || isFinal) && <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>{home.score ?? ''}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Last night's highlights */}
          {finishedLastNight.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>Last Night's Highlights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="stagger">
                {finishedLastNight.map(g => {
                  const home = g.homeTeam || {}, away = g.awayTeam || {}
                  return (
                    <button key={g.id} className="hover-lift" style={s.hlItem} onClick={() => openRecap(g)} disabled={loadingRecapId === g.id}>
                      <div style={s.hlTeams}>
                        {away.logo && <img src={away.darkLogo || away.logo} alt="" style={s.hlLogo} />}
                        <span style={s.hlScore}>{away.score}</span>
                        <span style={s.hlAbbrev}>{away.abbrev}</span>
                        <span style={s.hlAt}>@</span>
                        <span style={s.hlAbbrev}>{home.abbrev}</span>
                        <span style={s.hlScore}>{home.score}</span>
                        {home.logo && <img src={home.darkLogo || home.logo} alt="" style={s.hlLogo} />}
                      </div>
                      <span style={s.hlWatch}>{loadingRecapId === g.id ? 'Loading…' : '▶ Recap'}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* News sidebar */}
        <div className="home-sidebar">
          <div className="section-label">Latest News</div>
          {newsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="card" style={{ padding: 14 }}>
                  <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: 10 }} />
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="stagger">
              {news.map((a, i) => (
                <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="hover-lift" style={s.newsItem}>
                  <div style={s.newsDot} />
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
        </div>
      </div>

      {openPlayerId && <PlayerCard playerId={openPlayerId} onClose={() => setOpenPlayerId(null)} />}
      {videoId && <VideoModal videoId={videoId} onClose={() => setVideoId(null)} />}
    </div>
  )
}

function LeaderCard({ label, players, unit, accent, decimals = 0, onPick }) {
  const top = players?.[0]
  const rest = players?.slice(1, 5) || []
  const headshot = top ? playerHeadshot(top.playerId, top.teamAbbrevs) : null
  return (
    <div className="card" style={{ borderTop: `3px solid ${accent}`, padding: 14 }}>
      <div
        className={top ? 'hover-lift' : ''}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, borderRadius: 8, margin: -4, padding: 4 }}
        onClick={() => top && onPick(top.playerId)}
      >
        {headshot ? (
          <img src={headshot} alt="" style={s.leaderAvatar} onError={e => { e.target.style.display = 'none' }} />
        ) : (
          <div style={{ ...s.leaderAvatar, background: 'var(--surface2)' }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: 0.5 }}>{label} leader</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
            {top?.lastName || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {top ? `${top.teamAbbrevs?.split(',')[0]} · ${Number(top.value || 0).toFixed(decimals)} ${unit}` : 'Loading...'}
          </div>
        </div>
      </div>
      {rest.length > 0 && (
        <div style={s.leaderRest}>
          {rest.map((p, i) => (
            <div key={i} className="hover-lift" style={{ ...s.leaderRestRow, borderRadius: 6, padding: '0 4px', margin: '0 -4px' }} onClick={() => onPick(p.playerId)}>
              <span style={s.leaderRestRank}>{i + 2}</span>
              <span style={s.leaderRestName}>{p.lastName}</span>
              <span style={s.leaderRestValue}>{Number(p.value || 0).toFixed(decimals)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  commCard: {
    background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: 12, padding: '14px 16px', marginBottom: 20,
  },
  commHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commLabel: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase' },
  commText: { fontSize: 14, color: 'var(--text)', lineHeight: 1.6 },
  editBtn: { background: 'transparent', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: 'var(--gold)', cursor: 'pointer' },
  noteInput: { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 14, padding: '10px 12px', resize: 'vertical', fontFamily: "'Barlow',sans-serif", outline: 'none' },
  saveNoteBtn: { padding: '7px 18px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '7px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border2)', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  hero: {
    background: 'linear-gradient(135deg, #171a23 0%, #1d212c 100%)',
    border: '1px solid var(--border)',
    borderRadius: 16, padding: '22px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexWrap: 'wrap', marginBottom: 24,
    boxShadow: 'var(--shadow-md)',
    position: 'relative', overflow: 'hidden',
  },
  emptyHero: {
    background: 'linear-gradient(135deg, #171a23, #1d212c)',
    border: '1px solid var(--border)',
    borderRadius: 16, padding: '32px 24px',
    textAlign: 'center', marginBottom: 24,
    boxShadow: 'var(--shadow-md)',
  },
  spotlight: {
    height: 220, borderRadius: 16, marginBottom: 24,
    backgroundSize: 'cover', backgroundPosition: 'center 15%',
    position: 'relative', overflow: 'hidden',
    border: '1px solid rgba(45,226,230,0.25)',
    boxShadow: 'var(--shadow-md), 0 0 32px var(--ice-glow)',
  },
  spotlightScrim: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(90deg, rgba(15,17,23,0.95) 15%, rgba(15,17,23,0.55) 55%, rgba(15,17,23,0.15) 100%)',
  },
  spotlightContent: { position: 'absolute', left: 24, bottom: 20, right: 24 },
  spotlightTag: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ice)', marginBottom: 6 },
  spotlightName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 38, fontWeight: 700, color: 'var(--text)', lineHeight: 1 },
  spotlightSub: { fontSize: 14, color: 'var(--muted)', marginTop: 6 },
  spotlightHint: { fontSize: 11, color: 'var(--ice)', marginTop: 10, fontWeight: 600 },
  seasonBanner: {
    background: 'linear-gradient(135deg, rgba(200,16,46,0.12), rgba(200,16,46,0.03))',
    border: '1px solid rgba(200,16,46,0.25)',
    borderRadius: 12, padding: '14px 18px', marginBottom: 24,
    fontSize: 14, color: 'var(--text)', textAlign: 'center',
  },
  heroSub: { fontSize: 11, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  heroName: {
    fontFamily: "'Barlow Condensed',sans-serif",
    fontSize: 42, fontWeight: 700, color: 'var(--gold)', lineHeight: 1,
    textShadow: '0 0 30px rgba(255,215,0,0.25)',
  },
  heroRight: { textAlign: 'right' },
  heroRank: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 700, color: 'var(--text)' },
  heroPts: { fontSize: 13, color: 'var(--dim)', marginTop: 4 },
  leaderAvatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface2)', flexShrink: 0 },
  leaderRest: { borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 },
  leaderRestRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  leaderRestRank: { color: 'var(--dim)', width: 14, flexShrink: 0 },
  leaderRestName: { color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  leaderRestValue: { color: 'var(--text)', fontWeight: 600 },
  divGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  divCard: { display: 'flex', alignItems: 'center', gap: 10 },
  divLogo: { width: 30, height: 30, objectFit: 'contain', flexShrink: 0 },
  divName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  divSub: { fontSize: 11, color: 'var(--dim)' },
  divPts: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--text)', flexShrink: 0 },
  divPtsLabel: { fontSize: 9, color: 'var(--dim)', marginLeft: 3, fontFamily: "'Barlow',sans-serif" },
  seeMore: { display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--info)', textDecoration: 'none' },
  gamesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 8 },
  hlItem: {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '12px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    textDecoration: 'none', color: 'inherit', font: 'inherit', textAlign: 'left',
  },
  hlTeams: { display: 'flex', alignItems: 'center', gap: 8 },
  hlLogo: { width: 20, height: 20, objectFit: 'contain' },
  hlScore: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)' },
  hlAbbrev: { fontSize: 13, color: 'var(--muted)', fontWeight: 600 },
  hlAt: { fontSize: 11, color: 'var(--dim)' },
  hlWatch: { fontSize: 12, fontWeight: 600, color: 'var(--info)' },
  newsItem: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    textDecoration: 'none', color: 'inherit',
    transition: 'box-shadow 0.15s',
  },
  newsDot: { width: 7, height: 7, background: 'var(--red)', borderRadius: '50%', marginTop: 6, flexShrink: 0 },
  newsSrc: { fontSize: 10, color: 'var(--red)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  newsTitle: { fontSize: 14, color: 'var(--text)', lineHeight: 1.45 },
  newsMeta: { fontSize: 12, color: 'var(--dim)', marginTop: 4 },
  newsArrow: { fontSize: 18, color: 'var(--dim)', marginLeft: 4, flexShrink: 0 },
}

const FALLBACK_NEWS = [
  { headline: "Buffalo Sabres end 14-year playoff drought — what changed this season", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 7200000).toISOString() },
  { headline: "Avalanche Presidents' Trophy winners open as heavy Western Conference favorites", source: "NHL.com", link: "https://nhl.com", published: new Date(Date.now() - 14400000).toISOString() },
  { headline: "Lightning vs Canadiens: A 2021 Stanley Cup Final rematch — who has the edge?", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 21600000).toISOString() },
  { headline: "Battle of Pennsylvania is back: Penguins vs Flyers rivalry renewed in playoffs", source: "The Athletic", link: "https://theathletic.com", published: new Date(Date.now() - 28800000).toISOString() },
  { headline: "Golden Knights fire Cassidy, hire Tortorella — can new coach spark a Cup run?", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 36000000).toISOString() },
]
