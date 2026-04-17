import { useEffect, useState } from 'react'
import { supabase, ROUNDS, ROUND_POINTS, PICKS_DEADLINE } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const isLocked = () => new Date() > PICKS_DEADLINE
const NHL_LOGO = (abbrev) => `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`

// Card dimensions — slightly larger logos
const CW = 84
const CH = 60
const GAP = 6
const RGAP = 38
const MGAP = 16

const SOURCES = {
  e5: { t1: 'e1', t2: 'e3' },
  e6: { t1: 'e2', t2: 'e4' },
  e7: { t1: 'e5', t2: 'e6' },
  w5: { t1: 'w1', t2: 'w3' },
  w6: { t1: 'w2', t2: 'w4' },
  w7: { t1: 'w5', t2: 'w6' },
  f1: { t1: 'w7', t2: 'e7' },
}

const WEST_COLS = [
  { round: 1, ids: ['w1','w2','w3','w4'], pts: 5  },
  { round: 2, ids: ['w5','w6'],           pts: 10 },
  { round: 3, ids: ['w7'],               pts: 15 },
]
const EAST_COLS = [
  { round: 3, ids: ['e7'],               pts: 15 },
  { round: 2, ids: ['e5','e6'],           pts: 10 },
  { round: 1, ids: ['e1','e2','e3','e4'], pts: 5  },
]

export default function PicksPage() {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})
  const [overrides, setOverrides] = useState({})
  const [seriesScores, setSeriesScores] = useState({})
  const [seriesLive, setSeriesLive] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [popup, setPopup] = useState(null)
  const [popupTeam, setPopupTeam] = useState(null)
  const [popupGames, setPopupGames] = useState(null)
  const locked = isLocked()

  useEffect(() => { loadPicks(); loadOverrides(); loadSeriesScores(); loadSeriesLive() }, [])

  async function loadPicks() {
    const { data } = await supabase.from('picks').select('matchup_id, team, games').eq('user_id', user.id)
    if (data) {
      const obj = {}
      data.forEach(p => { obj[p.matchup_id] = { team: p.team, games: p.games } })
      setPicks(obj)
    }
  }

  async function loadOverrides() {
    const { data } = await supabase.from('matchup_overrides').select('*')
    if (data) {
      const obj = {}
      data.forEach(r => { obj[r.matchup_id] = r })
      setOverrides(obj)
    }
  }

  async function loadSeriesScores() {
    const { data } = await supabase.from('results').select('*')
    if (data) {
      const obj = {}
      data.forEach(r => { obj[r.matchup_id] = r })
      setSeriesScores(obj)
    }
  }

  async function loadSeriesLive() {
    const { data } = await supabase.from('series_scores').select('*')
    if (data) {
      const obj = {}
      data.forEach(r => { obj[r.matchup_id] = r })
      setSeriesLive(obj)
    }
  }

  function getBaseMatchup(id) {
    for (const r of ROUNDS) {
      const m = r.matchups.find(x => x.id === id)
      if (m) return { ...m, round: r.id }
    }
    return null
  }

  function getMatchup(id) {
    const base = getBaseMatchup(id)
    if (!base) return null
    const ov = overrides[id]
    if (!ov) return base
    return { ...base, t1: ov.t1||base.t1, a1: ov.a1||base.a1, t2: ov.t2||base.t2, a2: ov.a2||base.a2 }
  }

  function resolveTeamAbbrev(matchupId, slot) {
    const sources = SOURCES[matchupId]
    if (!sources) {
      const m = getMatchup(matchupId)
      const a = slot === 't1' ? m?.a1 : m?.a2
      return (!a || a === 'TBD' || a === '???') ? null : a
    }
    const srcId = sources[slot]
    const srcPick = picks[srcId]
    if (!srcPick?.team) return null
    return resolveTeamAbbrev(srcId, srcPick.team)
  }

  function resolveMatchup(id) {
    const base = getMatchup(id)
    if (!base) return null
    if (!SOURCES[id]) return base
    const a1 = resolveTeamAbbrev(id, 't1')
    const a2 = resolveTeamAbbrev(id, 't2')
    return { ...base, a1: a1||null, t1: a1||'TBD', a2: a2||null, t2: a2||'TBD' }
  }

  function getPickedAbbrev(id) {
    const pick = picks[id]
    if (!pick?.team) return null
    return resolveTeamAbbrev(id, pick.team)
  }

  function openPopup(id) {
    if (locked) return
    const m = resolveMatchup(id)
    if (!m || (!m.a1 && !m.a2)) return
    const ex = picks[id]
    setPopupTeam(ex?.team || null)
    setPopupGames(ex?.games || null)
    setPopup({ id, m })
  }

  function confirmPick() {
    if (!popupTeam || !popupGames || !popup) return
    setPicks(p => ({ ...p, [popup.id]: { team: popupTeam, games: popupGames } }))
    setPopup(null); setPopupTeam(null); setPopupGames(null)
  }

  async function submitBracket() {
    setSaving(true)
    const rows = Object.entries(picks).map(([matchup_id, pick]) => ({
      user_id: user.id, matchup_id, team: pick.team||null, games: pick.games||null,
    }))
    await supabase.from('picks').upsert(rows, { onConflict: 'user_id,matchup_id' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 4000)
  }

  const totalPickable = 15
  const picksMade = Object.keys(picks).filter(id => picks[id]?.team && picks[id]?.games).length

  return (
    <div style={{ paddingBottom: 48 }}>
      {locked ? (
        <div style={s.lockedBanner}>🔒 Picks locked — deadline passed Sunday noon PT.</div>
      ) : (
        <div style={s.openBanner}>
          <span>Lock by <strong>Sunday April 20, noon PT</strong></span>
          <span style={{ color: '#5DCAA5', fontWeight: 700 }}>{picksMade}/{totalPickable} picks</span>
        </div>
      )}

      <div style={s.scrollWrap}>
        <div style={s.bracketOuter}>
          <Bracket
            westCols={WEST_COLS} eastCols={EAST_COLS}
            resolveMatchup={resolveMatchup} picks={picks}
            getPickedAbbrev={getPickedAbbrev} onTap={openPopup}
            locked={locked} seriesScores={seriesScores} seriesLive={seriesLive}
          />
        </div>
      </div>

      {!locked && (
        <div style={{ padding: '0 16px' }}>
          <button
            style={{ ...s.submitBtn, opacity: picksMade === 0 ? 0.5 : 1 }}
            onClick={submitBracket} disabled={saving || picksMade === 0}>
            {saving ? <span className="spinner" /> : `Submit Bracket  (${picksMade}/${totalPickable})`}
          </button>
          {saved && <div style={s.savedMsg}>✓ Bracket saved! Update anytime until Sunday noon PT.</div>}
        </div>
      )}

      {popup && (
        <PickPopup
          m={popup.m} matchupId={popup.id}
          selectedTeam={popupTeam} selectedGames={popupGames}
          onTeam={setPopupTeam} onGames={setPopupGames}
          onConfirm={confirmPick} onClose={() => setPopup(null)}
        />
      )}
    </div>
  )
}

function Bracket({ westCols, eastCols, resolveMatchup, picks, getPickedAbbrev, onTap, locked, seriesScores, seriesLive }) {
  const colW = CW + RGAP
  const matchupH = CH * 2 + GAP
  const totalH = 4 * matchupH + 3 * MGAP + 70

  const wX = [0, colW, colW * 2]
  const FINAL_X = colW * 3 + 24
  const eX = [FINAL_X + CW + RGAP + 24, FINAL_X + CW + RGAP * 2 + CW + 24, FINAL_X + CW + RGAP * 3 + CW * 2 + 24]
  const totalW = eX[2] + CW + 16

  function getMatchupCenters(count, totalHeight) {
    const spacing = totalHeight / count
    return Array.from({ length: count }, (_, i) => 52 + spacing * i + spacing / 2)
  }

  const r1Centers = getMatchupCenters(4, totalH - 52)
  const r2Centers = getMatchupCenters(2, totalH - 52)
  const r3Centers = getMatchupCenters(1, totalH - 52)

  function getCenters(round) {
    if (round === 1) return r1Centers
    if (round === 2) return r2Centers
    return r3Centers
  }

  const connColor = 'rgba(255,255,255,0.15)'
  const connActive = 'rgba(200,16,46,0.4)'
  const LABEL_Y = 20

  // Check if a pick flows through a connector (for active line color)
  function hasPickFlowing(fromId) {
    return !!getPickedAbbrev(fromId)
  }

  return (
    <svg width={totalW} height={totalH + 20} style={{ display: 'block' }}>
      <defs>
        <style>{`
          .round-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; fill: #6B8FAD; letter-spacing: 1.5px; text-transform: uppercase; }
          .conf-lbl  { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; fill: #C8102E; letter-spacing: 2px; text-transform: uppercase; }
          .final-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; fill: #FFD700; letter-spacing: 2px; text-transform: uppercase; }
          .tbd-lbl   { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; fill: rgba(255,255,255,0.15); }
          .tap-hint  { font-family: 'Barlow', sans-serif; font-size: 8px; fill: rgba(255,255,255,0.2); }
          .series-score { font-family: 'Barlow Condensed', sans-serif; font-size: 9px; font-weight: 700; fill: #A0B4CC; letter-spacing: 0.5px; }
          .series-final { font-family: 'Barlow Condensed', sans-serif; font-size: 8px; font-weight: 700; fill: #FFD700; letter-spacing: 0.5px; }
          .games-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 9px; font-weight: 700; fill: #85B7EB; }
          .champ-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 8px; font-weight: 700; fill: #FFD700; letter-spacing: 1px; text-transform: uppercase; }
        `}</style>
      </defs>

      {/* Labels */}
      <text x={wX[0] + CW/2} y={LABEL_Y} textAnchor="middle" className="conf-lbl">WEST</text>
      <text x={eX[2] + CW/2} y={LABEL_Y} textAnchor="middle" className="conf-lbl">EAST</text>
      <text x={FINAL_X + CW/2} y={LABEL_Y} textAnchor="middle" className="final-lbl">🏆 FINAL</text>

      {westCols.map((col, ci) => (
        <text key={`wl${ci}`} x={wX[ci] + CW/2} y={36} textAnchor="middle" className="round-lbl">
          {`R${col.round} · +${col.pts}pts`}
        </text>
      ))}
      {eastCols.map((col, ci) => (
        <text key={`el${ci}`} x={eX[ci] + CW/2} y={36} textAnchor="middle" className="round-lbl">
          {`R${col.round} · +${col.pts}pts`}
        </text>
      ))}

      {/* West connectors */}
      {[0,1,2,3].map(i => {
        const srcCy = r1Centers[i], destCy = r2Centers[Math.floor(i/2)]
        const srcX = wX[0]+CW, destX = wX[1], midX = srcX + RGAP/2
        const active = hasPickFlowing(WEST_COLS[0].ids[i])
        const c = active ? connActive : connColor
        return <g key={`wc1_${i}`}>
          <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
        </g>
      })}
      {[0,1].map(i => {
        const srcCy = r2Centers[i], destCy = r3Centers[0]
        const srcX = wX[1]+CW, destX = wX[2], midX = srcX + RGAP/2
        const active = hasPickFlowing(WEST_COLS[1].ids[i])
        const c = active ? connActive : connColor
        return <g key={`wc2_${i}`}>
          <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
        </g>
      })}
      {(() => {
        const active = hasPickFlowing('w7')
        const c = active ? connActive : connColor
        return <line x1={wX[2]+CW} y1={r3Centers[0]} x2={FINAL_X} y2={r3Centers[0]} stroke={c} strokeWidth={active?2:1.5}/>
      })()}

      {/* East connectors */}
      {[0,1,2,3].map(i => {
        const srcCy = r1Centers[i], destCy = r2Centers[Math.floor(i/2)]
        const srcX = eX[2], destX = eX[1]+CW, midX = srcX - RGAP/2
        const active = hasPickFlowing(EAST_COLS[2].ids[i])
        const c = active ? connActive : connColor
        return <g key={`ec1_${i}`}>
          <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
        </g>
      })}
      {[0,1].map(i => {
        const srcCy = r2Centers[i], destCy = r3Centers[0]
        const srcX = eX[1], destX = eX[0]+CW, midX = srcX - RGAP/2
        const active = hasPickFlowing(EAST_COLS[1].ids[i])
        const c = active ? connActive : connColor
        return <g key={`ec2_${i}`}>
          <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
          <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={c} strokeWidth={active?2:1.5}/>
        </g>
      })}
      {(() => {
        const active = hasPickFlowing('e7')
        const c = active ? connActive : connColor
        return <line x1={eX[0]} y1={r3Centers[0]} x2={FINAL_X+CW} y2={r3Centers[0]} stroke={c} strokeWidth={active?2:1.5}/>
      })()}

      {/* West matchup cards */}
      {westCols.map((col, ci) =>
        col.ids.map((id, mi) => (
          <MatchupCardSVG key={id} id={id} x={wX[ci]} cy={getCenters(col.round)[mi]}
            resolveMatchup={resolveMatchup} picks={picks}
            getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked}
            seriesResult={seriesScores[id]} liveScore={seriesLive[id]} />
        ))
      )}

      {/* East matchup cards */}
      {eastCols.map((col, ci) =>
        col.ids.map((id, mi) => (
          <MatchupCardSVG key={id} id={id} x={eX[ci]} cy={getCenters(col.round)[mi]}
            resolveMatchup={resolveMatchup} picks={picks}
            getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked}
            seriesResult={seriesScores[id]} liveScore={seriesLive[id]} />
        ))
      )}

      {/* Final card */}
      <FinalCardSVG x={FINAL_X} cy={r3Centers[0]}
        resolveMatchup={resolveMatchup} picks={picks}
        getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked}
        seriesResult={seriesScores['f1']} liveScore={seriesLive['f1']} />
    </svg>
  )
}

function MatchupCardSVG({ id, x, cy, resolveMatchup, picks, getPickedAbbrev, onTap, locked, seriesResult, liveScore }) {
  const m = resolveMatchup(id)
  if (!m) return null
  const pick = picks[id]
  const pickedAbbrev = getPickedAbbrev(id)
  const matchupH = CH * 2 + GAP
  const y = cy - matchupH / 2
  const bothTBD = !m.a1 && !m.a2
  const canTap = !locked && !bothTBD
  const hasResult = seriesResult?.winner && seriesResult?.games

  // Build series score label
  let scoreLabel = null
  let scoreLabelClass = 'series-score'
  if (hasResult) {
    scoreLabel = `${seriesResult.winner} wins in ${seriesResult.games}`
    scoreLabelClass = 'series-final'
  } else if (liveScore && (liveScore.score1 > 0 || liveScore.score2 > 0)) {
    scoreLabel = `${liveScore.score1}-${liveScore.score2}`
    scoreLabelClass = 'series-score'
  }

  return (
    <g style={{ cursor: canTap ? 'pointer' : 'default' }} onClick={() => canTap && onTap(id)}>
      <TeamCardSVG x={x} y={y} abbrev={m.a1}
        isPicked={pickedAbbrev === m.a1}
        isLoser={!!pickedAbbrev && pickedAbbrev !== m.a1}
        isEliminated={hasResult && seriesResult.winner !== m.a1}
        isWinner={hasResult && seriesResult.winner === m.a1}
        games={pickedAbbrev === m.a1 ? pick?.games : null} />

      {/* Series score between the two cards */}
      <text x={x + CW/2} y={y + CH + GAP/2 + 3} textAnchor="middle" className={scoreLabelClass}>
        {scoreLabel || 'vs'}
      </text>

      <TeamCardSVG x={x} y={y + CH + GAP} abbrev={m.a2}
        isPicked={pickedAbbrev === m.a2}
        isLoser={!!pickedAbbrev && pickedAbbrev !== m.a2}
        isEliminated={hasResult && seriesResult.winner !== m.a2}
        isWinner={hasResult && seriesResult.winner === m.a2}
        games={pickedAbbrev === m.a2 ? pick?.games : null} />

      {!pickedAbbrev && canTap && (
        <text x={x + CW/2} y={y + matchupH + 11} textAnchor="middle" className="tap-hint">tap to pick</text>
      )}
    </g>
  )
}

function TeamCardSVG({ x, y, abbrev, isPicked, isLoser, isEliminated, isWinner, games }) {
  const isTBD = !abbrev || abbrev === 'TBD' || abbrev === '???'
  const opacity = (isLoser || isEliminated) ? 0.28 : 1

  let fill = '#162b45'
  let stroke = 'rgba(255,255,255,0.1)'
  let strokeW = 1
  if (isPicked) { fill = '#0d2d1a'; stroke = '#1D9E75'; strokeW = 2 }
  if (isWinner)  { fill = '#1a2d10'; stroke = '#39c575'; strokeW = 2 }

  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={CW} height={CH} rx="8"
        fill={fill} stroke={stroke} strokeWidth={strokeW} />

      {isTBD ? (
        <text x={x+CW/2} y={y+CH/2+6} textAnchor="middle" className="tbd-lbl">?</text>
      ) : (
        <>
          <foreignObject x={x+5} y={y+5} width={CW-10} height={CH-(games?18:10)}>
            <div xmlns="http://www.w3.org/1999/xhtml"
              style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={NHL_LOGO(abbrev)} alt={abbrev}
                style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain',
                  filter: (isLoser||isEliminated) ? 'grayscale(100%) opacity(0.4)' : 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
                onError={e => {
                  e.target.style.display='none'
                  e.target.parentNode.innerHTML=`<span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:white;">${abbrev}</span>`
                }}
              />
            </div>
          </foreignObject>
          {games && (
            <>
              <rect x={x+5} y={y+CH-16} width={CW-10} height={13} rx="4"
                fill="rgba(55,138,221,0.2)" stroke="rgba(55,138,221,0.35)" strokeWidth="1"/>
              <text x={x+CW/2} y={y+CH-6} textAnchor="middle" className="games-lbl">in {games}</text>
            </>
          )}
          {isPicked && <circle cx={x+CW-9} cy={y+9} r={4} fill="#1D9E75"/>}
          {isWinner && <circle cx={x+CW-9} cy={y+9} r={4} fill="#39c575"/>}
        </>
      )}
    </g>
  )
}

function FinalCardSVG({ x, cy, resolveMatchup, picks, getPickedAbbrev, onTap, locked, seriesResult, liveScore }) {
  const m = resolveMatchup('f1')
  if (!m) return null
  const matchupH = CH * 2 + GAP + 28
  const y = cy - matchupH / 2
  const pickedAbbrev = getPickedAbbrev('f1')
  const pick = picks['f1']
  const bothTBD = !m.a1 && !m.a2
  const canTap = !locked && !bothTBD
  const hasResult = seriesResult?.winner && seriesResult?.games
  const cardW = CW + 10
  const cardX = x - 5

  return (
    <g style={{ cursor: canTap ? 'pointer' : 'default' }} onClick={() => canTap && onTap('f1')}>
      {/* Championship border if champion picked */
      {pickedAbbrev && (
        <rect x={cardX-2} y={y+14} width={cardW+4} height={matchupH+2} rx="12"
          fill="none" stroke="rgba(255,215,0,0.2)" strokeWidth="2"/>
      )}

      {/* "Stanley Cup Champion" label */}
      {pickedAbbrev && (
        <text x={x+CW/2} y={y+12} textAnchor="middle" className="champ-lbl">
          My Champion
        </text>
      )}

      <TeamCardSVG x={x} y={y+22} abbrev={m.a1}
        isPicked={pickedAbbrev === m.a1}
        isLoser={!!pickedAbbrev && pickedAbbrev !== m.a1}
        isEliminated={hasResult && seriesResult.winner !== m.a1}
        isWinner={hasResult && seriesResult.winner === m.a1}
        games={pickedAbbrev === m.a1 ? pick?.games : null} />

      {hasResult ? (
        <text x={x+CW/2} y={y+22+CH+GAP/2+4} textAnchor="middle" className="series-final">
          {`${seriesResult.winner} in ${seriesResult.games}`}
        </text>
      ) : (
        <text x={x+CW/2} y={y+22+CH+GAP/2+4} textAnchor="middle" className="series-score">vs</text>
      )}

      <TeamCardSVG x={x} y={y+22+CH+GAP+12} abbrev={m.a2}
        isPicked={pickedAbbrev === m.a2}
        isLoser={!!pickedAbbrev && pickedAbbrev !== m.a2}
        isEliminated={hasResult && seriesResult.winner !== m.a2}
        isWinner={hasResult && seriesResult.winner === m.a2}
        games={pickedAbbrev === m.a2 ? pick?.games : null} />
    </g>
  )
}

function PickPopup({ m, matchupId, selectedTeam, selectedGames, onTeam, onGames, onConfirm, onClose }) {
  const round = (() => { for (const r of ROUNDS) { if (r.matchups.find(x => x.id === matchupId)) return r.id } return 1 })()
  const pts = ROUND_POINTS[round] || 5
  const canConfirm = selectedTeam && selectedGames

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalTop}>
          <div>
            <div style={s.modalTitle}>Round {round} Pick</div>
            <div style={s.modalSub}>+{pts} pts per correct pick</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.sectionLabel}>Who wins?</div>
        <div style={s.teamGrid}>
          {[{slot:'t1', abbrev:m.a1, name:m.t1}, {slot:'t2', abbrev:m.a2, name:m.t2}].map(({slot, abbrev, name}) => {
            const isTBD = !abbrev || abbrev === 'TBD' || abbrev === '???'
            const sel = selectedTeam === slot
            return (
              <button key={slot}
                style={{
                  ...s.teamBtn,
                  borderColor: sel ? '#1D9E75' : 'rgba(255,255,255,0.1)',
                  background: sel ? 'rgba(29,158,117,0.08)' : '#F8F9FB',
                  opacity: isTBD ? 0.35 : 1,
                  transform: sel ? 'scale(1.02)' : 'scale(1)',
                }}
                onClick={() => !isTBD && onTeam(slot)} disabled={isTBD}>
                {!isTBD ? (
                  <img src={NHL_LOGO(abbrev)} alt={abbrev} style={s.popupLogo}
                    onError={e => { e.target.style.display='none' }} />
                ) : (
                  <div style={s.tbdCircle}>?</div>
                )}
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, marginTop:8, color: sel ? '#041E42' : '#6B7A8D' }}>
                  {isTBD ? 'TBD' : abbrev}
                </div>
                <div style={{ fontSize:11, color:'#6B8FAD', marginTop:2 }}>{isTBD ? '—' : name?.split(' ').pop()}</div>
                {sel && <div style={s.selCheck}>✓</div>}
              </button>
            )
          })}
        </div>

        <div style={{ ...s.sectionLabel, marginTop:20 }}>How many games?</div>
        <div style={s.gamesGrid}>
          {[4,5,6,7].map(g => (
            <button key={g}
              style={{
                ...s.gamesBtn,
                borderColor: selectedGames===g ? '#C8102E' : 'rgba(255,255,255,0.1)',
                background: selectedGames===g ? 'rgba(200,16,46,0.08)' : '#F8F9FB',
                color: selectedGames===g ? '#C8102E' : '#6B7A8D',
                transform: selectedGames===g ? 'scale(1.04)' : 'scale(1)',
              }}
              onClick={() => onGames(g)}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:30, fontWeight:700, display:'block' }}>{g}</span>
              <span style={{ fontSize:10 }}>games</span>
            </button>
          ))}
        </div>

        <button style={{ ...s.confirmBtn, opacity: canConfirm ? 1 : 0.35, marginTop:20 }}
          onClick={canConfirm ? onConfirm : undefined} disabled={!canConfirm}>
          {canConfirm ? '✓  Confirm Pick' : 'Pick a team and series length'}
        </button>
      </div>
    </div>
  )
}

const s = {
  lockedBanner: { margin:'0 16px 12px', background:'#FFF0F1', border:'1px solid rgba(200,16,46,0.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#C8102E' },
  openBanner: { margin:'0 16px 12px', background:'#F0FBF7', border:'1px solid rgba(29,158,117,0.2)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#0F6E56', display:'flex', justifyContent:'space-between', alignItems:'center' },
  scrollWrap: { overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'0 12px 16px' },
  bracketOuter: { display:'inline-block', minWidth:'100%' },
  submitBtn: { width:'100%', marginTop:4, padding:'14px', background:'#C8102E', color:'white', border:'none', borderRadius:12, fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'opacity 0.2s' },
  savedMsg: { textAlign:'center', color:'#0F6E56', fontSize:13, marginTop:10, fontWeight:500 },
  overlay: { position:'fixed', inset:0, background:'rgba(4,30,66,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:400, backdropFilter:'blur(8px)' },
  modal: { background:'#FFFFFF', border:'1px solid rgba(0,0,0,0.1)', borderRadius:'20px 20px 0 0', padding:'20px 20px 40px', width:'100%', maxWidth:500, animation:'slideUp 0.2s ease both', boxShadow:'0 -4px 30px rgba(0,0,0,0.15)' },
  modalTop: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
  modalTitle: { fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:700, color:'#041E42' },
  modalSub: { fontSize:12, color:'#9CAAB8', marginTop:2 },
  closeBtn: { background:'transparent', border:'none', color:'#9CAAB8', fontSize:22, cursor:'pointer', padding:4, lineHeight:1 },
  sectionLabel: { fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700, color:'#9CAAB8', letterSpacing:2, textTransform:'uppercase', marginBottom:12 },
  teamGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
  teamBtn: { padding:'16px 8px', borderRadius:14, border:'2px solid', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', transition:'all 0.15s', position:'relative', background:'#F8F9FB' },
  popupLogo: { width:68, height:68, objectFit:'contain' },
  tbdCircle: { width:68, height:68, borderRadius:'50%', background:'#F0F2F5', border:'1px dashed rgba(0,0,0,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, color:'#9CAAB8' },
  selCheck: { position:'absolute', top:8, right:8, width:22, height:22, background:'#1D9E75', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'white', fontWeight:700 },
  gamesGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 },
  gamesBtn: { padding:'14px 6px', borderRadius:12, border:'2px solid', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer', transition:'all 0.15s' },
  confirmBtn: { width:'100%', padding:'14px', background:'#C8102E', color:'white', border:'none', borderRadius:12, fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer', transition:'opacity 0.2s' },
}
