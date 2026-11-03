import { useState, useEffect, useRef, useCallback } from 'react'
import PlayerCard from '../components/PlayerCard.jsx'
import { playerHeadshot, isPlayoffs, fetchPlayerLanding } from '../lib/nhl.js'

const PROXY = '/api/nhl'
const SEASON_ID = '20262027'
const getGameType = () => isPlayoffs() ? 3 : 2

function formatTOI(secs) {
  if (secs == null) return '—'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function posFilter(pos) {
  if (pos === 'F') return "positionCode in ('L','C','R')"
  if (pos === 'D') return 'positionCode=D'
  return null
}

async function fetchStats({ endpoint, sortField, ascending, minFilter, limit, pos, extraCayenne }) {
  const gt = getGameType()
  const cayenne = extraCayenne ||
    `gameTypeId=${gt} and seasonId<=${SEASON_ID} and seasonId>=${SEASON_ID}`
  const pf = pos && pos !== 'all' ? posFilter(pos) : null
  const baseFact = minFilter || 'gamesPlayed>=1'
  const factCayenneExp = pf ? `${baseFact} and ${pf}` : baseFact
  const params = {
    endpoint,
    isAggregate: 'false',
    isGame: 'false',
    start: '0',
    limit: String(limit || 10),
    factCayenneExp,
    cayenneExp: cayenne,
    sort: JSON.stringify([{ property: sortField, direction: ascending ? 'ASC' : 'DESC' }]),
  }
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${PROXY}?${qs}`)
  if (!res.ok) throw new Error('Stats fetch failed')
  const data = await res.json()
  return data?.data || []
}

// ─── Category config ────────────────────────────────────────────────────────
const CATEGORIES = [
  // SCORING
  { id: 'goals',       label: 'Goals',         tab: 'scoring',  endpoint: 'skater/summary',     sortField: 'goals',                    field: 'goals',                fmt: v => v },
  { id: 'assists',     label: 'Assists',        tab: 'scoring',  endpoint: 'skater/summary',     sortField: 'assists',                  field: 'assists',              fmt: v => v },
  { id: 'points',      label: 'Points',         tab: 'scoring',  endpoint: 'skater/summary',     sortField: 'points',                   field: 'points',               fmt: v => v },
  { id: 'plusMinus',   label: 'Plus / Minus',   tab: 'scoring',  endpoint: 'skater/summary',     sortField: 'plusMinus',                field: 'plusMinus',            fmt: v => v > 0 ? `+${v}` : String(v) },
  { id: 'shootPct',    label: 'Shooting %',     tab: 'scoring',  endpoint: 'skater/summary',     sortField: 'shootingPct',              field: 'shootingPct',          fmt: v => `${(v * 100).toFixed(1)}%`, minFilter: 'gamesPlayed>=5' },
  { id: 'toi',         label: 'TOI / Game',     tab: 'scoring',  endpoint: 'skater/summary',     sortField: 'timeOnIcePerGame',         field: 'timeOnIcePerGame',     fmt: formatTOI },
  // SPECIAL TEAMS
  { id: 'ppPoints',    label: 'PP Points',      tab: 'special',  endpoint: 'skater/powerplay',   sortField: 'ppPoints',                 field: 'ppPoints',             fmt: v => v },
  { id: 'ppGoals',     label: 'PP Goals',       tab: 'special',  endpoint: 'skater/powerplay',   sortField: 'ppGoals',                  field: 'ppGoals',              fmt: v => v },
  { id: 'ppTOI',       label: 'PP TOI / Game',  tab: 'special',  endpoint: 'skater/powerplay',   sortField: 'ppTimeOnIcePerGame',       field: 'ppTimeOnIcePerGame',   fmt: formatTOI },
  { id: 'shGoals',     label: 'SH Goals',       tab: 'special',  endpoint: 'skater/penaltykill', sortField: 'shGoals',                  field: 'shGoals',              fmt: v => v },
  { id: 'shPoints',    label: 'SH Points',      tab: 'special',  endpoint: 'skater/penaltykill', sortField: 'shPoints',                 field: 'shPoints',             fmt: v => v },
  { id: 'shTOI',       label: 'PK TOI / Game',  tab: 'special',  endpoint: 'skater/penaltykill', sortField: 'shTimeOnIcePerGame',       field: 'shTimeOnIcePerGame',   fmt: formatTOI },
  // ADVANCED
  { id: 'hits',        label: 'Hits',           tab: 'advanced', endpoint: 'skater/realtime',    sortField: 'hits',                     field: 'hits',                 fmt: v => v },
  { id: 'blocks',      label: 'Blocked Shots',  tab: 'advanced', endpoint: 'skater/realtime',    sortField: 'blockedShots',             field: 'blockedShots',         fmt: v => v },
  { id: 'takeaways',   label: 'Takeaways',      tab: 'advanced', endpoint: 'skater/realtime',    sortField: 'takeaways',                field: 'takeaways',            fmt: v => v },
  { id: 'giveaways',   label: 'Fewest Giveaways', tab: 'advanced', endpoint: 'skater/realtime', sortField: 'giveaways',                field: 'giveaways',            fmt: v => v, ascending: true, minFilter: 'gamesPlayed>=5' },
  { id: 'hitsPer60',   label: 'Hits / 60',      tab: 'advanced', endpoint: 'skater/realtime',    sortField: 'hitsPer60',                field: 'hitsPer60',            fmt: v => v?.toFixed(1), minFilter: 'gamesPlayed>=5' },
  { id: 'blocksPer60', label: 'Blocks / 60',    tab: 'advanced', endpoint: 'skater/realtime',    sortField: 'blockedShotsPer60',        field: 'blockedShotsPer60',    fmt: v => v?.toFixed(1), minFilter: 'gamesPlayed>=5' },
  // FACEOFFS
  { id: 'foWins',      label: 'FO Wins',        tab: 'faceoffs', endpoint: 'skater/faceoffwins', sortField: 'totalFaceoffWins',         field: 'totalFaceoffWins',     fmt: v => v },
  { id: 'foPct',       label: 'FO Win %',       tab: 'faceoffs', endpoint: 'skater/faceoffwins', sortField: 'faceoffWinPct',            field: 'faceoffWinPct',        fmt: v => `${(v * 100).toFixed(1)}%`, minFilter: 'totalFaceoffs>=20' },
  { id: 'ozFO',        label: 'OZ FO Wins',     tab: 'faceoffs', endpoint: 'skater/faceoffwins', sortField: 'offensiveZoneFaceoffWins', field: 'offensiveZoneFaceoffWins', fmt: v => v },
  { id: 'dzFO',        label: 'DZ FO Wins',     tab: 'faceoffs', endpoint: 'skater/faceoffwins', sortField: 'defensiveZoneFaceoffWins', field: 'defensiveZoneFaceoffWins', fmt: v => v },
  // GOALIES
  { id: 'gWins',       label: 'Wins',           tab: 'goalies',  endpoint: 'goalie/summary',     sortField: 'wins',                     field: 'wins',                 fmt: v => v, nameField: 'goalieFullName', minFilter: 'gamesPlayed>=3' },
  { id: 'gGAA',        label: 'Goals Against Avg', tab: 'goalies', endpoint: 'goalie/summary',   sortField: 'goalsAgainstAverage',      field: 'goalsAgainstAverage',  fmt: v => v?.toFixed(2), nameField: 'goalieFullName', ascending: true, minFilter: 'gamesPlayed>=5' },
  { id: 'gSvPct',      label: 'Save %',         tab: 'goalies',  endpoint: 'goalie/summary',     sortField: 'savePct',                  field: 'savePct',              fmt: v => v?.toFixed(3), nameField: 'goalieFullName', minFilter: 'gamesPlayed>=5' },
  { id: 'gShutouts',   label: 'Shutouts',       tab: 'goalies',  endpoint: 'goalie/summary',     sortField: 'shutouts',                 field: 'shutouts',             fmt: v => v, nameField: 'goalieFullName', minFilter: 'gamesPlayed>=3' },
  { id: 'gSaves',      label: 'Saves',          tab: 'goalies',  endpoint: 'goalie/summary',     sortField: 'saves',                    field: 'saves',                fmt: v => v, nameField: 'goalieFullName', minFilter: 'gamesPlayed>=3' },
]

const TABS = [
  { id: 'scoring',  label: 'Scoring' },
  { id: 'special',  label: 'Special Teams' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'faceoffs', label: 'Faceoffs' },
  { id: 'goalies',  label: 'Goalies' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function initials(fullName) {
  if (!fullName) return ''
  const parts = fullName.trim().split(' ')
  return parts.length >= 2 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : fullName
}

// ─── Radar chart for comparison ─────────────────────────────────────────────
function RadarChart({ axes }) {
  // axes: [{ label, valA, valB, max }]
  const N = axes.length
  const cx = 140, cy = 140, r = 100

  function pt(i, val, max) {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2
    const pct = max > 0 ? Math.min(Math.max(val, 0) / max, 1) : 0
    return { x: cx + r * pct * Math.cos(angle), y: cy + r * pct * Math.sin(angle) }
  }

  function labelPt(i) {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2
    return { x: cx + (r + 22) * Math.cos(angle), y: cy + (r + 22) * Math.sin(angle) }
  }

  const polyA = axes.map((a, i) => { const p = pt(i, a.valA, a.max); return `${p.x},${p.y}` }).join(' ')
  const polyB = axes.map((a, i) => { const p = pt(i, a.valB, a.max); return `${p.x},${p.y}` }).join(' ')
  const outerRing = axes.map((_, i) => { const p = pt(i, 1, 1); return `${p.x},${p.y}` }).join(' ')

  return (
    <svg width="280" height="280" viewBox="0 0 280 280" style={{ display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <polygon key={pct} points={axes.map((_, i) => { const p = { x: cx + r * pct * Math.cos((Math.PI * 2 * i / N) - Math.PI / 2), y: cy + r * pct * Math.sin((Math.PI * 2 * i / N) - Math.PI / 2) }; return `${p.x},${p.y}` }).join(' ')} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const outer = pt(i, 1, 1)
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      })}
      <polygon points={polyA} fill="rgba(200,16,46,0.25)" stroke="#C8102E" strokeWidth="2" strokeLinejoin="round" />
      <polygon points={polyB} fill="rgba(212,168,0,0.2)" stroke="#D4A800" strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const lp = labelPt(i)
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#9CAAB8" fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.5">
            {a.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Single leader row with bar ──────────────────────────────────────────────
const RANK_COLORS = { 1: '#C8102E', 2: '#A8A8B0', 3: '#B87333' }

function LeaderRow({ rank, fullName, team, playerId, value, pct, onClick }) {
  const isTop = rank === 1
  const shot = playerHeadshot(playerId, team)
  const rankColor = RANK_COLORS[rank]
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        ...s.leaderRow,
        ...(isTop ? s.leaderRowTop : {}),
        ...(hovered && !isTop ? { background: 'rgba(255,255,255,0.03)', borderLeft: '2px solid rgba(200,16,46,0.4)' } : {}),
      }}
      onClick={() => onClick(playerId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        ...s.rank,
        ...(rankColor ? { color: rankColor, fontSize: isTop ? 10 : 11 } : {}),
      }}>{rank}</span>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={shot}
          alt=""
          style={{
            ...s.headshot,
            ...(isTop ? s.headshotTop : {}),
            ...(rank === 2 ? { border: '1.5px solid rgba(168,168,176,0.5)' } : {}),
            ...(rank === 3 ? { border: '1.5px solid rgba(184,115,51,0.5)' } : {}),
          }}
          onError={e => { e.target.style.visibility = 'hidden' }}
        />
      </div>

      <div style={s.playerMeta}>
        <div style={{ ...s.playerName, ...(isTop ? s.playerNameTop : {}) }}>
          {isTop ? fullName : initials(fullName)}
        </div>
        <div style={s.teamPill}>{team}</div>
      </div>

      <div style={s.rightBlock}>
        <span style={{ ...s.statNum, ...(isTop ? s.statNumTop : {}) }}>{value}</span>
        <div style={s.barTrack}>
          <div style={{ ...s.bar, width: `${Math.max(pct * 100, 3)}%`, opacity: isTop ? 1 : 0.7 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Leader card (top 10 + see all) ─────────────────────────────────────────
function LeaderCard({ cat, pos, onViewAll, onPlayerClick, cache }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const nameF = cat.nameField || 'skaterFullName'
  const key = `${cat.id}|${pos}`

  useEffect(() => {
    if (cache.current[key]) { setData(cache.current[key]); setLoading(false); return }
    setLoading(true)
    fetchStats({ ...cat, limit: 10, pos: cat.tab === 'goalies' ? 'all' : pos })
      .then(rows => { cache.current[key] = rows; setData(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [key])

  const vals = data.map(r => Math.abs(r[cat.field] || 0))
  const maxVal = Math.max(...vals, 1)

  return (
    <div className="card" style={s.leaderCard}>
      <div style={s.cardHead}>
        <div style={s.cardAccent} />
        <span style={s.catLabel}>{cat.label}</span>
        <button style={s.viewAllBtn} onClick={() => onViewAll(cat)}>See all →</button>
      </div>
      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}><span className="spinner" /></div>
      ) : data.length === 0 ? (
        <div style={{ color: '#9CAAB8', fontSize: 13, padding: '16px 0' }}>No data yet.</div>
      ) : (
        <div>
          {data.map((p, i) => (
            <LeaderRow
              key={p.playerId}
              rank={i + 1}
              fullName={p[nameF] || ''}
              team={p.teamAbbrevs?.split(',')[0] || ''}
              playerId={p.playerId}
              value={cat.fmt ? cat.fmt(p[cat.field]) : p[cat.field]}
              pct={Math.abs(p[cat.field] || 0) / maxVal}
              onClick={onPlayerClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Full list drawer ────────────────────────────────────────────────────────
function FullListDrawer({ cat, pos, onPlayerClick, onClose, cache }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const nameF = cat?.nameField || 'skaterFullName'
  const key = `all|${cat?.id}|${pos}`

  useEffect(() => {
    if (!cat) return
    if (cache.current[key]) { setData(cache.current[key]); setLoading(false); return }
    setLoading(true)
    fetchStats({ ...cat, limit: 100, pos: cat.tab === 'goalies' ? 'all' : pos })
      .then(rows => { cache.current[key] = rows; setData(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cat?.id, pos])

  const maxVal = Math.max(...data.map(r => Math.abs(r[cat?.field] || 0)), 1)

  return (
    <div style={s.drawerOverlay} onClick={onClose}>
      <div style={s.drawer} onClick={e => e.stopPropagation()}>
        <div style={s.drawerHead}>
          <span style={s.drawerTitle}>{cat?.label}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : (
          <div style={s.drawerBody}>
            {data.map((p, i) => (
              <div key={p.playerId} style={s.drawerRow} onClick={() => { onPlayerClick(p.playerId); onClose() }}>
                <span style={{ ...s.rank, minWidth: 28 }}>{i + 1}</span>
                <img
                  src={playerHeadshot(p.playerId, p.teamAbbrevs)}
                  alt=""
                  style={s.mugshot}
                  onError={e => { e.target.style.display = 'none' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EEF4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p[nameF]}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CAAB8' }}>
                    {p.teamAbbrevs?.split(',')[0]} · {p.positionCode || ''}
                  </div>
                </div>
                <div style={s.barTrackSm}>
                  <div style={{ ...s.bar, width: `${Math.max((Math.abs(p[cat?.field] || 0) / maxVal) * 100, 2)}%` }} />
                </div>
                <span style={{ ...s.statNum, minWidth: 42, textAlign: 'right', fontSize: 14 }}>
                  {cat?.fmt ? cat.fmt(p[cat.field]) : p[cat?.field]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Comparison section ──────────────────────────────────────────────────────
const COMPARE_AXES = [
  { label: 'Goals',    fieldA: 'goals',           fieldB: 'goals',           max: 60 },
  { label: 'Assists',  fieldA: 'assists',          fieldB: 'assists',         max: 90 },
  { label: 'Points',   fieldA: 'points',           fieldB: 'points',          max: 130 },
  { label: '+/-',      fieldA: 'plusMinus',        fieldB: 'plusMinus',       max: 50, shift: 25 },
  { label: 'TOI/G',    fieldA: 'avgToi',           fieldB: 'avgToi',          max: 1500 },
  { label: 'GP',       fieldA: 'gamesPlayed',      fieldB: 'gamesPlayed',     max: 82 },
]

function extractStats(landing) {
  const sub = landing?.featuredStats?.regularSeason?.subSeason
  const bio = landing?.featuredStats?.regularSeason?.career
  if (!sub) return null
  return {
    goals: sub.goals || 0,
    assists: sub.assists || 0,
    points: sub.points || 0,
    plusMinus: sub.plusMinus || 0,
    avgToi: sub.avgToi ? parseInt(sub.avgToi?.split(':')[0]) * 60 + parseInt(sub.avgToi?.split(':')[1]) : 0,
    gamesPlayed: sub.gamesPlayed || 0,
  }
}

function PlayerPicker({ label, selected, stats, onSearch, results, onSelect, onClear, loading }) {
  return (
    <div style={s.pickerWrap}>
      <div style={s.pickerLabel}>{label}</div>
      {selected ? (
        <div style={s.pickerSelected}>
          <img src={playerHeadshot(selected.playerId, selected.teamAbbrevs)} alt="" style={s.mugMd} onError={e => { e.target.style.display = 'none' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#E8EEF4' }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: '#9CAAB8' }}>{selected.teamAbbrevs}</div>
            {stats && (
              <div style={{ fontSize: 12, color: '#9CAAB8', marginTop: 4 }}>
                {stats.gamesPlayed} GP · {stats.goals}G · {stats.assists}A · {stats.points} PTS
              </div>
            )}
          </div>
          <button style={s.clearBtn} onClick={onClear}>✕</button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            style={s.searchInput}
            placeholder="Search player…"
            onChange={e => onSearch(e.target.value)}
          />
          {loading && <span className="spinner" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} />}
          {results.length > 0 && (
            <div style={s.searchDropdown}>
              {results.map(p => (
                <div key={p.playerId} style={s.dropdownRow} onClick={() => onSelect(p)}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: '#9CAAB8', marginLeft: 6 }}>{p.teamAbbrev || p.lastTeamAbbrev}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CompareSection({ onPlayerClick }) {
  const [playerA, setPlayerA] = useState(null)
  const [playerB, setPlayerB] = useState(null)
  const [statsA, setStatsA] = useState(null)
  const [statsB, setStatsB] = useState(null)
  const [resultsA, setResultsA] = useState([])
  const [resultsB, setResultsB] = useState([])
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const timerA = useRef(null)
  const timerB = useRef(null)

  async function search(q, setResults, setLoading) {
    if (!q || q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const qs = new URLSearchParams({ endpoint: 'search/player', culture: 'en-us', limit: '6', q }).toString()
      const res = await fetch(`${PROXY}?${qs}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.filter(p => p.active) : [])
    } catch {}
    setLoading(false)
  }

  function debounceSearch(q, setResults, setLoading, timerRef) {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(q, setResults, setLoading), 300)
  }

  async function selectPlayer(p, setPlayer, setStats, setResults) {
    setResults([])
    const landing = await fetchPlayerLanding(p.playerId)
    const st = extractStats(landing)
    setPlayer({ ...p, playerId: p.playerId, name: p.name, teamAbbrevs: p.teamAbbrev || p.lastTeamAbbrev })
    setStats(st)
  }

  const radarAxes = COMPARE_AXES.map(a => ({
    label: a.label,
    valA: (statsA?.[a.fieldA] || 0) + (a.shift || 0),
    valB: (statsB?.[a.fieldB] || 0) + (a.shift || 0),
    max: a.max,
  }))

  const statRows = [
    { label: 'Games Played', a: statsA?.gamesPlayed ?? '—', b: statsB?.gamesPlayed ?? '—' },
    { label: 'Goals',        a: statsA?.goals ?? '—',       b: statsB?.goals ?? '—' },
    { label: 'Assists',      a: statsA?.assists ?? '—',     b: statsB?.assists ?? '—' },
    { label: 'Points',       a: statsA?.points ?? '—',      b: statsB?.points ?? '—' },
    { label: 'Plus/Minus',   a: statsA?.plusMinus != null ? (statsA.plusMinus > 0 ? `+${statsA.plusMinus}` : statsA.plusMinus) : '—', b: statsB?.plusMinus != null ? (statsB.plusMinus > 0 ? `+${statsB.plusMinus}` : statsB.plusMinus) : '—' },
    { label: 'Avg TOI',      a: statsA?.avgToi ? formatTOI(statsA.avgToi) : '—', b: statsB?.avgToi ? formatTOI(statsB.avgToi) : '—' },
  ]

  return (
    <div style={{ marginTop: 48 }}>
      <div className="section-label">Compare Players</div>
      <div style={s.compareGrid}>
        <PlayerPicker
          label="Player A"
          selected={playerA}
          stats={statsA}
          onSearch={q => debounceSearch(q, setResultsA, setLoadingA, timerA)}
          results={resultsA}
          onSelect={p => selectPlayer(p, setPlayerA, setStatsA, setResultsA)}
          onClear={() => { setPlayerA(null); setStatsA(null) }}
          loading={loadingA}
        />
        <div style={s.vsLabel}>VS</div>
        <PlayerPicker
          label="Player B"
          selected={playerB}
          stats={statsB}
          onSearch={q => debounceSearch(q, setResultsB, setLoadingB, timerB)}
          results={resultsB}
          onSelect={p => selectPlayer(p, setPlayerB, setStatsB, setResultsB)}
          onClear={() => { setPlayerB(null); setStatsB(null) }}
          loading={loadingB}
        />
      </div>

      {playerA && playerB && (
        <div style={s.compareResults}>
          <div style={s.radarWrap}>
            <RadarChart axes={radarAxes} />
            <div style={s.radarLegend}>
              <span style={{ color: '#C8102E', fontWeight: 700 }}>■ {playerA.name}</span>
              <span style={{ color: '#D4A800', fontWeight: 700 }}>■ {playerB.name}</span>
            </div>
          </div>

          <div style={s.statTable}>
            <div style={s.statTableHead}>
              <span />
              <span style={{ color: '#C8102E', fontWeight: 700, textAlign: 'center' }}>{playerA.name?.split(' ').slice(-1)[0]}</span>
              <span style={{ color: '#D4A800', fontWeight: 700, textAlign: 'center' }}>{playerB.name?.split(' ').slice(-1)[0]}</span>
            </div>
            {statRows.map(row => {
              const aNum = typeof row.a === 'number' ? row.a : null
              const bNum = typeof row.b === 'number' ? row.b : null
              const aWins = aNum != null && bNum != null && aNum > bNum
              const bWins = aNum != null && bNum != null && bNum > aNum
              return (
                <div key={row.label} style={s.statRow}>
                  <span style={{ color: '#9CAAB8', fontSize: 12 }}>{row.label}</span>
                  <span style={{ textAlign: 'center', fontWeight: 700, color: aWins ? '#C8102E' : '#E8EEF4' }}>{row.a}</span>
                  <span style={{ textAlign: 'center', fontWeight: 700, color: bWins ? '#D4A800' : '#E8EEF4' }}>{row.b}</span>
                </div>
              )
            })}
            <div style={{ marginTop: 12, padding: '0 4px' }}>
              <button style={{ ...s.viewCardBtn, borderColor: '#C8102E', color: '#C8102E' }} onClick={() => onPlayerClick(playerA.playerId)}>
                {playerA.name?.split(' ').slice(-1)[0]} Full Card →
              </button>
              <button style={{ ...s.viewCardBtn, borderColor: '#D4A800', color: '#D4A800', marginLeft: 8 }} onClick={() => onPlayerClick(playerB.playerId)}>
                {playerB.name?.split(' ').slice(-1)[0]} Full Card →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('scoring')
  const [pos, setPos] = useState('all')
  const [drawer, setDrawer] = useState(null)
  const [playerCard, setPlayerCard] = useState(null)
  const cache = useRef({})

  const tabCats = CATEGORIES.filter(c => c.tab === activeTab)

  return (
    <div className="page-wrap fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <div className="section-label" style={{ margin: 0 }}>Stats Leaders</div>
        {activeTab !== 'goalies' && (
          <div style={s.posFilter}>
            {['all', 'F', 'D'].map(p => (
              <button key={p} style={{ ...s.posBtn, ...(pos === p ? s.posBtnActive : {}) }} onClick={() => setPos(p)}>
                {p === 'all' ? 'All Skaters' : p === 'F' ? 'Forwards' : 'Defense'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(activeTab === t.id ? s.tabActive : {}) }} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={s.grid}>
        {tabCats.map(cat => (
          <LeaderCard
            key={`${cat.id}|${pos}`}
            cat={cat}
            pos={pos}
            onViewAll={setDrawer}
            onPlayerClick={setPlayerCard}
            cache={cache}
          />
        ))}
      </div>

      <CompareSection onPlayerClick={setPlayerCard} />

      {drawer && (
        <FullListDrawer
          cat={drawer}
          pos={pos}
          onPlayerClick={setPlayerCard}
          onClose={() => setDrawer(null)}
          cache={cache}
        />
      )}

      {playerCard && (
        <PlayerCard playerId={playerCard} onClose={() => setPlayerCard(null)} />
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  // Nav tabs
  tabs: { display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' },
  tab: { padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#5B6A7A', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1, textTransform: 'uppercase', transition: 'all 0.15s' },
  tabActive: { background: 'var(--red)', color: '#fff', border: '1px solid var(--red)', fontWeight: 700 },

  // Position filter
  posFilter: { display: 'flex', gap: 4 },
  posBtn: { padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#5B6A7A', cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 },
  posBtnActive: { background: 'rgba(200,16,46,0.12)', border: '1px solid rgba(200,16,46,0.5)', color: 'var(--red)', fontWeight: 700 },

  // Card grid
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },

  // Leader card
  leaderCard: { padding: '0 0 4px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' },
  cardHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  cardAccent: { width: 3, height: 16, borderRadius: 2, background: 'var(--red)', flexShrink: 0 },
  catLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', color: '#C8D0D9', flex: 1 },
  viewAllBtn: { background: 'rgba(200,16,46,0.1)', border: '1px solid rgba(200,16,46,0.3)', color: '#C8102E', fontSize: 10, cursor: 'pointer', fontWeight: 800, padding: '4px 10px', borderRadius: 20, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.8, textTransform: 'uppercase' },

  // Leader rows
  leaderRow: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px 5px', cursor: 'pointer', transition: 'background 0.12s, border-left 0.12s', borderLeft: '2px solid transparent' },
  leaderRowTop: { padding: '10px 14px 8px', background: 'rgba(200,16,46,0.04)', borderBottom: '1px solid rgba(200,16,46,0.08)' },

  rank: { fontSize: 10, color: '#3E5068', fontWeight: 700, minWidth: 14, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif" },

  headshot: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', flexShrink: 0 },
  headshotTop: { width: 38, height: 38, border: '2px solid rgba(200,16,46,0.4)' },

  playerMeta: { flex: 1, minWidth: 0 },
  playerName: { fontSize: 12, fontWeight: 600, color: '#C8D0D9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 },
  playerNameTop: { fontSize: 14, fontWeight: 700, color: '#E8EEF4' },

  teamPill: { fontSize: 9, fontWeight: 700, color: '#4B6072', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 },

  rightBlock: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 48 },
  statNum: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, color: '#E8EEF4', lineHeight: 1 },
  statNumTop: { fontSize: 26, color: '#fff' },

  barTrack: { width: 48, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  bar: { height: '100%', background: 'linear-gradient(90deg, #C8102E, #FF3355)', borderRadius: 2, transition: 'width 0.5s ease' },

  // Full list drawer
  drawerOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' },
  drawer: { background: 'var(--surface)', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' },
  drawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' },
  drawerTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: 1.5, textTransform: 'uppercase', color: '#E8EEF4' },
  closeBtn: { background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9CAAB8', fontSize: 16, cursor: 'pointer', padding: '6px 10px', borderRadius: 6 },
  drawerBody: { overflowY: 'auto', flex: 1, padding: '4px 12px 32px' },
  drawerRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.12s', borderRadius: 6 },
  mugshot: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  barTrackSm: { width: 56, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 },

  // Compare section
  compareGrid: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'start', marginTop: 16 },
  vsLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, color: '#3E5068', paddingTop: 32, letterSpacing: 2 },
  compareResults: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24, alignItems: 'start' },
  radarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  radarLegend: { display: 'flex', gap: 16, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 },

  statTable: { background: 'rgba(255,255,255,0.025)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)' },
  statTableHead: { display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, padding: '4px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12 },
  statRow: { display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 },

  pickerWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  pickerLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: '#3E5068', fontFamily: "'Barlow Condensed', sans-serif" },
  pickerSelected: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' },
  mugMd: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.05)', flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)' },
  clearBtn: { background: 'none', border: 'none', color: '#3E5068', cursor: 'pointer', fontSize: 14, marginLeft: 'auto', padding: 4 },
  searchInput: { width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E8EEF4', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  searchDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1A2232', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 4 },
  dropdownRow: { padding: '11px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.1s' },
  viewCardBtn: { background: 'none', border: '1px solid', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '5px 10px', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, textTransform: 'uppercase' },
}
