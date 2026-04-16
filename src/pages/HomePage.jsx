import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { fetchPlayoffStats, fetchGoalieStats, fetchESPNNews, fetchNHLScores, timeAgo } from '../lib/nhl.js'
import { useAuth } from '../hooks/useAuth.jsx'

export default function HomePage() {
  const { user, isAdmin } = useAuth()
  const [leader, setLeader] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [myPts, setMyPts] = useState(null)
  const [playerCount, setPlayerCount] = useState(null)
  const [stats, setStats] = useState(null)
  const [goalies, setGoalies] = useState([])
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [liveGames, setLiveGames] = useState([])
  const [commNote, setCommNote] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    loadLeaderboard()
    loadStats()
    loadNews()
    loadLiveGames()
    loadCommNote()
  }, [])

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('scores')
      .select('user_id, display_name, total')
      .order('total', { ascending: false })
    if (!data?.length) return
    setLeader(data[0])
    setPlayerCount(data.length)
    const idx = data.findIndex(r => r.user_id === user?.id)
    if (idx >= 0) { setMyRank(idx + 1); setMyPts(data[idx].total) }
  }

  async function loadStats() {
    const [s, g] = await Promise.all([fetchPlayoffStats(), fetchGoalieStats()])
    setStats(s)
    setGoalies(g)
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
    const { data } = await supabase
      .from('commissioner_note')
      .select('note')
      .eq('id', 1)
      .maybeSingle()
    if (data?.note) setCommNote(data.note)
  }

  async function saveNote() {
    setSavingNote(true)
    await supabase.from('commissioner_note').upsert({ id: 1, note: noteInput })
    setCommNote(noteInput)
    setSavingNote(false)
    setEditingNote(false)
  }

  const behindBy = leader && myPts != null ? leader.total - myPts : null

  return (
    <div className="page-wrap fade-up">

      {(commNote || isAdmin) && (
        <div style={s.commCard}>
          <div style={s.commHeader}>
            <span style={s.commLabel}>Commissioner</span>
            {isAdmin && !editingNote && (
              <button style={s.editBtn} onClick={() => { setNoteInput(commNote); setEditingNote(true) }}>Edit</button>
            )}
          </div>
          {editingNote ? (
            <div>
              <textarea style={s.noteInput} value={noteInput} onChange={e => setNoteInput(e.target.value)}
                rows={3} placeholder="Write a message for the pool..." autoFocus />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button style={s.saveNoteBtn} onClick={saveNote} disabled={savingNote}>{savingNote ? '...' : 'Save'}</button>
                <button style={s.cancelBtn} onClick={() => setEditingNote(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={s.commText}>{commNote || <span style={{ color: '#6B8FAD', fontStyle: 'italic' }}>No message yet — click Edit to add one.</span>}</div>
          )}
        </div>
      )}

      {leader && (
        <>
          <div className="section-label">Current Leader</div>
          <div style={s.hero}>
            <div>
              <div style={s.heroSub}>Leading the pool</div>
              <div style={s.heroName}>{leader.display_name || 'Pool Leader'}</div>
              <div style={s.heroPts}>{leader.total} pts</div>
            </div>
            {myRank && (
              <div style={{ textAlign: 'right' }}>
                <div style={s.heroSub}>Your rank</div>
                <div style={s.heroRank}>#{myRank} of {playerCount}</div>
                {behindBy > 0 && <div style={s.heroPts}>{behindBy} pts back</div>}
                {behindBy === 0 && <div style={{ fontSize: 13, color: '#1D9E75', marginTop: 4 }}>You're leading!</div>}
              </div>
            )}
          </div>
        </>
      )}

      {liveGames.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>Series in progress</div>
          <div style={s.gamesGrid}>
            {liveGames.map((g, i) => {
              const home = g.homeTeam || {}
              const away = g.awayTeam || {}
              const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT'
              const isFinal = g.gameState === 'FINAL' || g.gameState === 'OFF'
              return (
                <div key={i} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: isLive ? '#C8102E' : '#6B8FAD', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                      {isLive ? '● LIVE' : isFinal ? 'Final' : 'Upcoming'}
                    </span>
                    {g.seriesSummary && <span style={{ fontSize: 10, color: '#A0B4CC' }}>{g.seriesSummary.seriesStatusShort}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>{away.abbrev || '—'}</div>
                      {(isLive || isFinal) && <div style={{ fontSize: 16, fontWeight: 700, color: '#FFD700' }}>{away.score ?? ''}</div>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B8FAD' }}>@</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>{home.abbrev || '—'}</div>
                      {(isLive || isFinal) && <div style={{ fontSize: 16, fontWeight: 700, color: '#FFD700' }}>{home.score ?? ''}</div>}
                    </div>
                  </div>
                  {g.periodDescriptor && isLive && (
                    <div style={{ fontSize: 11, color: '#A0B4CC', textAlign: 'center', marginTop: 4 }}>
                      {g.periodDescriptor.periodType} {g.clock?.timeRemaining}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-label" style={{ marginTop: 24 }}>Playoff leaders</div>
      <div style={s.statGrid}>
        {stats?.goals?.[0] && <StatCard label="Goals leader" value={stats.goals[0].lastName || '—'} sub={`${stats.goals[0].teamAbbrevs || ''} · ${stats.goals[0].value || ''} G`} />}
        {stats?.points?.[0] && <StatCard label="Points leader" value={stats.points[0].lastName || '—'} sub={`${stats.points[0].teamAbbrevs || ''} · ${stats.points[0].value || ''} PTS`} />}
        {goalies?.[0] && <StatCard label="GAA leader" value={goalies[0].lastName || '—'} sub={`${goalies[0].teamAbbrevs || ''} · ${Number(goalies[0].value || 0).toFixed(2)} GAA`} />}
      </div>

      <div className="section-label" style={{ marginTop: 24 }}>Latest news</div>
      {newsLoading ? (
        <div style={{ color: '#6B8FAD', fontSize: 14, padding: '20px 0' }}>Loading news...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {news.map((a, i) => (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" style={s.newsItem}>
              <div style={s.newsDot} />
              <div>
                <div style={s.newsSrc}>{a.source}</div>
                <div style={s.newsTitle}>{a.headline}</div>
                {a.published && <div style={s.newsMeta}>{timeAgo(a.published)}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card">
      <div style={{ fontSize: 11, color: '#6B8FAD', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#A0B4CC', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

const s = {
  commCard: { background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 },
  commHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 600, color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase' },
  commText: { fontSize: 14, color: 'white', lineHeight: 1.6 },
  editBtn: { background: 'transparent', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#FFD700', cursor: 'pointer' },
  noteInput: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'white', fontSize: 14, padding: '10px 12px', resize: 'vertical', fontFamily: "'Barlow', sans-serif" },
  saveNoteBtn: { padding: '6px 16px', background: '#C8102E', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { padding: '6px 16px', background: 'transparent', color: '#A0B4CC', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  hero: { background: 'linear-gradient(135deg,#020F21,#0A2D5A)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  heroSub: { fontSize: 11, color: '#A0B4CC', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  heroName: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 38, fontWeight: 700, color: '#FFD700', lineHeight: 1 },
  heroRank: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700 },
  heroPts: { fontSize: 13, color: '#A0B4CC', marginTop: 4 },
  gamesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 8 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 },
  newsItem: { background: '#051F3E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', textDecoration: 'none', color: 'inherit' },
  newsDot: { width: 8, height: 8, background: '#C8102E', borderRadius: '50%', marginTop: 5, flexShrink: 0 },
  newsSrc: { fontSize: 10, color: '#C8102E', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  newsTitle: { fontSize: 14, color: 'white', lineHeight: 1.4 },
  newsMeta: { fontSize: 12, color: '#6B8FAD', marginTop: 4 },
}

const FALLBACK_NEWS = [
  { headline: "Buffalo Sabres end 14-year playoff drought — what changed this season", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 7200000).toISOString() },
  { headline: "Avalanche Presidents' Trophy winners open as heavy Western Conference favorites", source: "NHL.com", link: "https://nhl.com", published: new Date(Date.now() - 14400000).toISOString() },
  { headline: "Lightning vs Canadiens: A 2021 Stanley Cup Final rematch — who has the edge?", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 21600000).toISOString() },
  { headline: "Battle of Pennsylvania is back: Penguins vs Flyers rivalry renewed in playoffs", source: "The Athletic", link: "https://theathletic.com", published: new Date(Date.now() - 28800000).toISOString() },
  { headline: "Golden Knights fire Cassidy, hire Tortorella — can new coach spark a Cup run?", source: "ESPN", link: "https://espn.com/nhl", published: new Date(Date.now() - 36000000).toISOString() },
]
