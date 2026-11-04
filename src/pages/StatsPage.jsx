import { useState, useEffect, useRef } from 'react'
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

function posFilterStr(pos) {
  if (pos === 'F') return "positionCode in ('L','C','R')"
  if (pos === 'D') return 'positionCode=D'
  return null
}

async function fetchStats({ endpoint, sortField, ascending, minFilter, limit, pos }) {
  const gt = getGameType()
  const cayenne = `gameTypeId=${gt} and seasonId<=${SEASON_ID} and seasonId>=${SEASON_ID}`
  const pf = pos && pos !== 'all' ? posFilterStr(pos) : null
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

// ─── Section config ───────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'skaters',
    label: 'Skaters',
    nameField: 'skaterFullName',
    hasPosition: true,
    tabs: [
      { id: 'points',   label: 'Points',    statLabel: 'PTS',     endpoint: 'skater/summary',     sortField: 'points',               field: 'points',               fmt: v => v },
      { id: 'goals',    label: 'Goals',     statLabel: 'G',       endpoint: 'skater/summary',     sortField: 'goals',                field: 'goals',                fmt: v => v },
      { id: 'assists',  label: 'Assists',   statLabel: 'A',       endpoint: 'skater/summary',     sortField: 'assists',              field: 'assists',              fmt: v => v },
      { id: 'plusMinus',label: '+/−',       statLabel: '+/−',     endpoint: 'skater/summary',     sortField: 'plusMinus',            field: 'plusMinus',            fmt: v => v > 0 ? `+${v}` : String(v) },
      { id: 'hits',     label: 'Hits',      statLabel: 'HITS',    endpoint: 'skater/realtime',    sortField: 'hits',                 field: 'hits',                 fmt: v => v },
      { id: 'blocks',   label: 'Blocks',    statLabel: 'BLK',     endpoint: 'skater/realtime',    sortField: 'blockedShots',         field: 'blockedShots',         fmt: v => v },
      { id: 'ppPoints', label: 'PP Points', statLabel: 'PP PTS',  endpoint: 'skater/powerplay',   sortField: 'ppPoints',             field: 'ppPoints',             fmt: v => v },
      { id: 'foPct',    label: 'FO%',       statLabel: 'FO WIN%', endpoint: 'skater/faceoffwins', sortField: 'faceoffWinPct',        field: 'faceoffWinPct',        fmt: v => `${(v * 100).toFixed(1)}%`, minFilter: 'totalFaceoffs>=20' },
    ],
  },
  {
    id: 'goalies',
    label: 'Goalies',
    nameField: 'goalieFullName',
    hasPosition: false,
    tabs: [
      { id: 'wins',     label: 'Wins',      statLabel: 'W',       endpoint: 'goalie/summary',     sortField: 'wins',                 field: 'wins',                 fmt: v => v,              minFilter: 'gamesPlayed>=3' },
      { id: 'gaa',      label: 'GAA',       statLabel: 'GAA',     endpoint: 'goalie/summary',     sortField: 'goalsAgainstAverage',  field: 'goalsAgainstAverage',  fmt: v => v?.toFixed(2), ascending: true, minFilter: 'gamesPlayed>=5' },
      { id: 'svPct',    label: 'SV%',       statLabel: 'SV%',     endpoint: 'goalie/summary',     sortField: 'savePct',              field: 'savePct',              fmt: v => v?.toFixed(3), minFilter: 'gamesPlayed>=5' },
      { id: 'shutouts', label: 'Shutouts',  statLabel: 'SO',      endpoint: 'goalie/summary',     sortField: 'shutouts',             field: 'shutouts',             fmt: v => v,              minFilter: 'gamesPlayed>=3' },
    ],
  },
]

const RANK_COLORS = { 1: '#C8102E', 2: '#9A9AA8', 3: '#B87333' }

// ─── Full list drawer ─────────────────────────────────────────────────────────
function FullListDrawer({ tab, nameField, pos, onPlayerClick, onClose }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const key = `all|${tab?.id}|${pos}`
  const cacheRef = useRef({})

  useEffect(() => {
    if (!tab) return
    if (cacheRef.current[key]) { setData(cacheRef.current[key]); setLoading(false); return }
    setLoading(true)
    fetchStats({ ...tab, limit: 100, pos })
      .then(rows => { cacheRef.current[key] = rows; setData(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tab?.id, pos])

  const maxVal = Math.max(...data.map(r => Math.abs(r[tab?.field] || 0)), 1)

  return (
    <div style={s.drawerOverlay} onClick={onClose}>
      <div style={s.drawer} onClick={e => e.stopPropagation()}>
        <div style={s.drawerHead}>
          <span style={s.drawerTitle}>{tab?.label} Leaders</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
        ) : (
          <div style={s.drawerBody}>
            {data.map((p, i) => {
              const rankColor = RANK_COLORS[i + 1]
              const val = tab?.fmt ? tab.fmt(p[tab.field]) : p[tab?.field]
              const pct = Math.abs(p[tab?.field] || 0) / maxVal
              return (
                <div
                  key={p.playerId}
                  style={s.drawerRow}
                  onClick={() => { onPlayerClick(p.playerId); onClose() }}
                >
                  <span style={{ ...s.rankNum, color: rankColor || '#3E5068', minWidth: 24 }}>{i + 1}</span>
                  <img
                    src={playerHeadshot(p.playerId, p.teamAbbrevs)}
                    alt=""
                    style={s.mugshot}
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EEF4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p[nameField]}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4B6072', letterSpacing: 0.8, textTransform: 'uppercase' }}>{p.teamAbbrevs?.split(',')[0]}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color: '#E8EEF4' }}>{val}</span>
                    <div style={s.barTrackSm}>
                      <div style={{ ...s.bar, width: `${Math.max(pct * 100, 2)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────
function SectionBlock({ section, globalPos, onPlayerClick, onViewAll }) {
  const [activeTabId, setActiveTabId] = useState(section.tabs[0].id)
  const [pos, setPos] = useState('all')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [featuredIdx, setFeaturedIdx] = useState(0)
  const cache = useRef({})

  const activeTab = section.tabs.find(t => t.id === activeTabId)
  const effectivePos = section.hasPosition ? pos : 'all'
  const cacheKey = `${activeTabId}|${effectivePos}`

  useEffect(() => {
    if (cache.current[cacheKey]) {
      setData(cache.current[cacheKey]); setLoading(false); setFeaturedIdx(0); return
    }
    setLoading(true)
    fetchStats({ ...activeTab, limit: 10, pos: effectivePos })
      .then(rows => { cache.current[cacheKey] = rows; setData(rows); setLoading(false); setFeaturedIdx(0) })
      .catch(() => setLoading(false))
  }, [cacheKey])

  const featured = data[featuredIdx]
  const nameField = section.nameField

  return (
    <div style={s.section}>
      {/* Section header row */}
      <div style={s.sectionHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: 1 }}>
          <span style={s.sectionLabel}>{section.label}</span>
          <div style={s.subTabBar}>
            {section.tabs.map(t => (
              <button
                key={t.id}
                style={{ ...s.subTab, ...(activeTabId === t.id ? s.subTabActive : {}) }}
                onClick={() => setActiveTabId(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {section.hasPosition && (
          <div style={s.posFilter}>
            {[['all', 'All'], ['F', 'Forwards'], ['D', 'Defense']].map(([val, label]) => (
              <button
                key={val}
                style={{ ...s.posBtn, ...(pos === val ? s.posBtnActive : {}) }}
                onClick={() => setPos(val)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={s.sectionBody}>
        {/* Left: featured player */}
        <div
          style={s.featuredPanel}
          onClick={() => featured && onPlayerClick(featured.playerId)}
        >
          {loading ? (
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} className="skeleton" />
          ) : featured ? (
            <>
              <img
                src={playerHeadshot(featured.playerId, featured.teamAbbrevs)}
                alt=""
                style={s.featuredShot}
                onError={e => { e.target.style.opacity = 0.2 }}
              />
              <div style={s.featuredRank}>#{featuredIdx + 1}</div>
              <div style={s.featuredName}>{featured[nameField]}</div>
              <div style={s.featuredTeam}>{featured.teamAbbrevs?.split(',')[0]}</div>
              <div style={s.featuredStatLabel}>{activeTab.statLabel}</div>
              <div style={s.featuredStatVal}>{activeTab.fmt(featured[activeTab.field])}</div>
            </>
          ) : null}
        </div>

        {/* Right: ranked list */}
        <div style={s.rankedList}>
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ padding: '11px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="skeleton" style={{ width: 20, height: 14, borderRadius: 2 }} />
                <div className="skeleton skeleton-text" style={{ width: '55%' }} />
                <div className="skeleton" style={{ width: 36, height: 20, borderRadius: 4, marginLeft: 'auto' }} />
              </div>
            ))
          ) : (
            data.map((p, i) => {
              const isActive = i === featuredIdx
              const rankColor = RANK_COLORS[i + 1]
              return (
                <div
                  key={p.playerId}
                  style={{
                    ...s.rankedRow,
                    ...(isActive ? s.rankedRowActive : {}),
                  }}
                  onMouseEnter={() => setFeaturedIdx(i)}
                  onClick={() => onPlayerClick(p.playerId)}
                >
                  <span style={{ ...s.rankNum, color: rankColor || '#3E5068' }}>{i + 1}</span>
                  <img
                    src={playerHeadshot(p.playerId, p.teamAbbrevs)}
                    alt=""
                    style={s.rowShot}
                    onError={e => { e.target.style.visibility = 'hidden' }}
                  />
                  <div style={s.rankedMeta}>
                    <span style={s.rankedName}>{p[nameField]}</span>
                    <span style={s.rankedTeam}>{p.teamAbbrevs?.split(',')[0]}</span>
                  </div>
                  <span style={s.rankedVal}>{activeTab.fmt(p[activeTab.field])}</span>
                </div>
              )
            })
          )}
          <button
            style={s.allLeadersBtn}
            onClick={() => onViewAll({ tab: activeTab, nameField: section.nameField, pos: effectivePos })}
          >
            All Leaders →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Radar chart ──────────────────────────────────────────────────────────────
function RadarChart({ axes }) {
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

// ─── Compare section ──────────────────────────────────────────────────────────
const COMPARE_AXES = [
  { label: 'Goals',   fieldA: 'goals',      fieldB: 'goals',      max: 60 },
  { label: 'Assists', fieldA: 'assists',     fieldB: 'assists',    max: 90 },
  { label: 'Points',  fieldA: 'points',      fieldB: 'points',     max: 130 },
  { label: '+/-',     fieldA: 'plusMinus',   fieldB: 'plusMinus',  max: 50, shift: 25 },
  { label: 'TOI/G',   fieldA: 'avgToi',      fieldB: 'avgToi',     max: 1500 },
  { label: 'GP',      fieldA: 'gamesPlayed', fieldB: 'gamesPlayed', max: 82 },
]

function extractStats(landing) {
  const sub = landing?.featuredStats?.regularSeason?.subSeason
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
    <div style={{ marginTop: 56 }}>
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [drawer, setDrawer] = useState(null) // { tab, nameField, pos }
  const [playerCard, setPlayerCard] = useState(null)

  return (
    <div className="page-wrap fade-up">
      <div className="section-label" style={{ marginBottom: 32 }}>Stats Leaders</div>

      {SECTIONS.map(section => (
        <SectionBlock
          key={section.id}
          section={section}
          onPlayerClick={setPlayerCard}
          onViewAll={setDrawer}
        />
      ))}

      <CompareSection onPlayerClick={setPlayerCard} />

      {drawer && (
        <FullListDrawer
          tab={drawer.tab}
          nameField={drawer.nameField}
          pos={drawer.pos}
          onPlayerClick={setPlayerCard}
          onClose={() => setDrawer(null)}
        />
      )}

      {playerCard && <PlayerCard playerId={playerCard} onClose={() => setPlayerCard(null)} />}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  // Section layout
  section: { marginBottom: 48 },

  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap', marginBottom: 0,
  },
  sectionLabel: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22,
    letterSpacing: 0.3, color: '#E8EEF4', flexShrink: 0,
  },

  subTabBar: {
    display: 'flex', gap: 0,
    borderBottom: '2px solid rgba(255,255,255,0.08)',
  },
  subTab: {
    padding: '9px 16px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
    borderBottom: '2px solid transparent', color: '#5B6A7A', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, textTransform: 'uppercase',
    transition: 'color 0.15s, border-color 0.15s', marginBottom: -2, whiteSpace: 'nowrap',
  },
  subTabActive: { borderBottom: '2px solid #C8102E', color: '#E8EEF4', fontWeight: 800 },

  posFilter: { display: 'flex', gap: 4 },
  posBtn: {
    padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#5B6A7A',
    cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  posBtnActive: { background: 'rgba(200,16,46,0.12)', border: '1px solid rgba(200,16,46,0.5)', color: '#C8102E', fontWeight: 700 },

  sectionBody: {
    display: 'flex', background: 'var(--surface)', borderRadius: '0 12px 12px 12px',
    border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  },

  // Featured player panel (left)
  featuredPanel: {
    width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '32px 20px 24px',
    background: 'rgba(0,0,0,0.15)', borderRight: '1px solid rgba(255,255,255,0.07)',
    textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s',
    minHeight: 300,
  },
  featuredShot: {
    width: 96, height: 96, borderRadius: '50%', objectFit: 'cover',
    border: '3px solid rgba(200,16,46,0.5)', marginBottom: 12,
    boxShadow: '0 0 24px rgba(200,16,46,0.2)',
  },
  featuredRank: {
    fontSize: 10, fontWeight: 800, color: '#C8102E', letterSpacing: 1.5,
    fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', marginBottom: 4,
  },
  featuredName: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 17,
    color: '#E8EEF4', lineHeight: 1.1, marginBottom: 4,
  },
  featuredTeam: {
    fontSize: 10, fontWeight: 700, color: '#4B6072', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 20,
  },
  featuredStatLabel: {
    fontSize: 9, fontWeight: 800, color: '#5B6A7A', letterSpacing: 2,
    textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 4,
  },
  featuredStatVal: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 56,
    color: '#fff', lineHeight: 1,
  },

  // Ranked list (right)
  rankedList: { flex: 1, padding: '4px 0 8px' },

  rankedRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
    cursor: 'pointer', transition: 'background 0.1s',
    borderLeft: '3px solid transparent',
  },
  rankedRowActive: {
    background: 'rgba(200,16,46,0.05)',
    borderLeft: '3px solid rgba(200,16,46,0.6)',
  },

  rankNum: {
    fontSize: 11, fontWeight: 800, minWidth: 20, textAlign: 'center',
    fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0,
  },
  rowShot: {
    width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
    background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  rankedMeta: { flex: 1, minWidth: 0 },
  rankedName: {
    display: 'block', fontSize: 13, fontWeight: 600, color: '#C8D0D9',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2,
  },
  rankedTeam: {
    fontSize: 9, fontWeight: 700, color: '#4B6072', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rankedVal: {
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20,
    color: '#E8EEF4', minWidth: 52, textAlign: 'right', flexShrink: 0,
  },

  allLeadersBtn: {
    background: 'none', border: 'none', color: '#C8102E', fontSize: 12, cursor: 'pointer',
    fontWeight: 800, padding: '8px 20px', fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: 0.5, textTransform: 'uppercase', display: 'block',
  },

  // Drawer
  drawerOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' },
  drawer: { background: 'var(--surface)', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' },
  drawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' },
  drawerTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: 1.5, textTransform: 'uppercase', color: '#E8EEF4' },
  closeBtn: { background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9CAAB8', fontSize: 16, cursor: 'pointer', padding: '6px 10px', borderRadius: 6 },
  drawerBody: { overflowY: 'auto', flex: 1, padding: '4px 12px 32px' },
  drawerRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.12s', borderRadius: 6 },
  mugshot: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  barTrackSm: { width: 56, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 },
  bar: { height: '100%', background: 'linear-gradient(90deg, #C8102E, #FF3355)', borderRadius: 2, transition: 'width 0.5s ease' },

  // Compare
  compareGrid: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'start', marginTop: 16 },
  vsLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, color: '#3E5068', paddingTop: 32, letterSpacing: 2 },
  compareResults: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24, alignItems: 'start' },
  radarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  radarLegend: { display: 'flex', gap: 16, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 },
  statTable: { background: 'rgba(255,255,255,0.025)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)' },
  statTableHead: { display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, padding: '4px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12 },
  statRow: { display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 },

  // Picker
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
