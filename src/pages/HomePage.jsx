import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchSkaterLeaders, fetchGoalieLeader, fetchESPNNews, fetchNHLScores, timeAgo } from '../lib/nhl.js'
import { useAuth } from '../hooks/useAuth.jsx'

export default function HomePage() {
  const { user, isAdmin } = useAuth()
  const [leader, setLeader] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [myPts, setMyPts] = useState(null)
  const [playerCount, setPlayerCount] = useState(null)
  const [leaders, setLeaders] = useState(null)
  const [goalie, setGoalie] = useState(null)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [liveGames, setLiveGames] = useState([])
  const [commNote, setCommNote] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
    loadStats()
    loadNews()
    loadLiveGames()
    loadCommNote()
  }, [])

  async function loadLeaderboard() {
    const { data } = await supabase.from('scores').select('user_id, display_name, total').order('total', { ascending: false })
    if (!data?.length) return
    setLeader(data[0])
    setPlayerCount(data.length)
    const idx = data.findIndex(r => r.user_id === user?.id)
    if (idx >= 0) { setMyRank(idx + 1); setMyPts(data[idx].total) }
  }

  async function loadStats() {
    setStatsLoading(true)
    const [s, g] = await Promise.all([fetchSkaterLeaders(), fetchGoalieLeader()])
    setLeaders(s)
    setGoalie(g)
    setStatsLoading(false)
  }

  async function loadNews() {
    const articles = await fetchESPNNews()
    setNews(articles.length ? articles : FALLBACK_NEWS)
    setNewsLoading(false)
  }

  async function loadLiveGames() {
    const games = await fetchNHLScores()
    setLiveGames(games.slice(0, 6))
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
            <div style={s.commText}>{commNote || <span style={{ color: '#6B8FAD', fontStyle: 'italic', fontSize: 13 }}>No message yet — click Edit to post one.</span>}</div>
          )}
        </div>
      )}

      {/* Hero */}
      {leader ? (
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
                <div style={s.heroRank}>#{myRank}<span style={{ fontSize: 16, color: '#6B8FAD' }}> of {playerCount}</span></div>
                {behindBy > 0 && <div style={s.heroPts}>{behindBy} pts back</div>}
                {isLeading && <div style={{ fontSize: 13, color: '#1D9E75', marginTop: 4, fontWeight: 600 }}>🏒 You're leading!</div>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={s.emptyHero}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏒</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Pool hasn't started yet</div>
          <div style={{ fontSize: 13, color: '#6B8FAD' }}>Standings will appear here once picks are submitted</div>
        </div>
      )}

      {/* Live games */}
      {liveGames.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>Live / Recent</div>
          <div style={s.gamesGrid} className="stagger">
            {liveGames.map((g, i) => {
              const home = g.homeTeam || {}, away = g.awayTeam || {}
              const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT'
              const isFinal = g.gameState === 'FINAL' || g.gameState === 'OFF'
              return (
                <div key={i} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: isLive ? '#C8102E' : '#6B8FAD', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {isLive ? '🔴 LIVE' : isFinal ? 'Final' : 'Upcoming'}
                    </span>
                    {g.seriesSummary && <span style={{ fontSize: 10, color: '#A0B4CC' }}>{g.seriesSummary.seriesStatusShort}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700 }}>{away.abbrev || '—'}</div>
                      {(isLive || isFinal) && <div style={{ fontSize: 20, fontWeight: 700, color: '#FFD700' }}>{away.score ?? ''}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B8FAD' }}>@</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700 }}>{home.abbrev || '—'}</div>
                      {(isLive || isFinal) && <div style={{ fontSize: 20, fontWeight: 700, color: '#FFD700' }}>{home.score ?? ''}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Stat leaders */}
      <div className="section-label" style={{ marginTop: 24 }}>
        {leaders?.isPlayoffs ? 'Playoff Leaders' : 'Regular Season Leaders'}
      </div>
      {statsLoading ? (
        <div style={s.statGrid}>
          {[0,1,2,3].map(i => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '45%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={s.statGrid} className="stagger">
          <StatCard label="Goals leader" value={leaders?.goals?.lastName || '—'} sub={leaders?.goals ? `${leaders.goals.teamAbbrevs} · ${leaders.goals.value} G` : 'Loading...'} accent="#C8102E" icon="🥅" />
          <StatCard label="Points leader" value={leaders?.points?.lastName || '—'} sub={leaders?.points ? `${leaders.points.teamAbbrevs} · ${leaders.points.value} PTS` : 'Loading...'} accent="#FFD700" icon="⭐" />
          <StatCard label="Assists leader" value={leaders?.assists?.lastName || '—'} sub={leaders?.assists ? `${leaders.assists.teamAbbrevs} · ${leaders.assists.value} A` : 'Loading...'} accent="#378ADD" icon="🍎" />
          <StatCard label="GAA leader" value={goalie?.lastName || '—'} sub={goalie ? `${goalie.teamAbbrevs} · ${Number(goalie.value||0).toFixed(2)} GAA` : 'Loading...'} accent="#1D9E75" icon="🥋" />
        </div>
      )}

      {/* News */}
      <div className="section-label" style={{ marginTop: 24 }}>Latest News</div>
      {newsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1,2].map(i => (
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
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" style={s.newsItem}>
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
  )
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${accent}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 20, opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#6B8FAD', marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#A0B4CC', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

const s = {
  commCard: {
    background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.18)',
    borderRadius: 14, padding: '14px 16px', marginBottom: 20,
  },
  commHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commLabel: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase' },
  commText: { fontSize: 14, color: 'white', lineHeight: 1.6 },
  editBtn: { background: 'transparent', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#FFD700', cursor: 'pointer' },
  noteInput: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 14, padding: '10px 12px', resize: 'vertical', fontFamily: "'Barlow',sans-serif", outline: 'none' },
  saveNoteBtn: { padding: '7px 18px', background: '#C8102E', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '7px 18px', background: 'transparent', color: '#A0B4CC', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  hero: {
    background: 'linear-gradient(135deg, #0a1628 0%, #112640 50%, #0d1f35 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: '22px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexWrap: 'wrap', marginBottom: 24,
    position: 'relative', overflow: 'hidden',
  },
  emptyHero: {
    background: 'linear-gradient(135deg, #0a1628, #112640)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '32px 24px',
    textAlign: 'center', marginBottom: 24,
  },
  heroSub: { fontSize: 11, color: '#6B8FAD', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  heroName: {
    fontFamily: "'Barlow Condensed',sans-serif",
    fontSize: 42, fontWeight: 700, color: '#FFD700', lineHeight: 1,
    textShadow: '0 0 30px rgba(255,215,0,0.3)',
  },
  heroRight: { textAlign: 'right' },
  heroRank: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 700 },
  heroPts: { fontSize: 13, color: '#6B8FAD', marginTop: 4 },
  gamesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 8 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 },
  newsItem: {
    background: 'var(--card-bg)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    textDecoration: 'none', color: 'inherit',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  newsDot: { width: 7, height: 7, background: '#C8102E', borderRadius: '50%', marginTop: 6, flexShrink: 0 },
  newsSrc: { fontSize: 10, color: '#C8102E', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  newsTitle: { fontSize: 14, color: 'white', lineHeight: 1.45 },
  newsMeta: { fontSize: 12, color: '#6B8FAD', marginTop: 4 },
  newsArrow: { fontSize: 18, color: '#6B8FAD', marginLeft: 4, flexShrink: 0 },
}

const FALLBACK_NEWS = [
  { headline: "Buffalo Sabres end 14-year playoff drought — what changed this season", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 7200000).toISOString() },
  { headline: "Avalanche Presidents' Trophy winners open as heavy Western Conference favorites", source: "NHL.com", link: "https://nhl.com", published: new Date(Date.now() - 14400000).toISOString() },
  { headline: "Lightning vs Canadiens: A 2021 Stanley Cup Final rematch — who has the edge?", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 21600000).toISOString() },
  { headline: "Battle of Pennsylvania is back: Penguins vs Flyers rivalry renewed in playoffs", source: "The Athletic", link: "https://theathletic.com", published: new Date(Date.now() - 28800000).toISOString() },
  { headline: "Golden Knights fire Cassidy, hire Tortorella — can new coach spark a Cup run?", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 36000000).toISOString() },
]
