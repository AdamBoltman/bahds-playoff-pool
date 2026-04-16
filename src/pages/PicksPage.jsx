import { useEffect, useState, useRef } from 'react'
import { supabase, ROUNDS, ROUND_POINTS, PICKS_DEADLINE } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const isLocked = () => new Date() > PICKS_DEADLINE
const NHL_LOGO = (abbrev) => `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`

// Card dimensions
const CW = 76   // card width
const CH = 52   // card height
const GAP = 8   // gap between cards in a matchup
const RGAP = 36 // gap between rounds (connector area)
const MGAP = 20 // vertical margin between matchups in a column

// Feed map: which matchup feeds into which slot of which parent
const SOURCES = {
  e5: { t1: 'e1', t2: 'e3' },
  e6: { t1: 'e2', t2: 'e4' },
  e7: { t1: 'e5', t2: 'e6' },
  w5: { t1: 'w1', t2: 'w3' },
  w6: { t1: 'w2', t2: 'w4' },
  w7: { t1: 'w5', t2: 'w6' },
  f1: { t1: 'w7', t2: 'e7' },
}

// West side: left→right. East side: right→left. Final in center.
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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [popup, setPopup] = useState(null)
  const [popupTeam, setPopupTeam] = useState(null)
  const [popupGames, setPopupGames] = useState(null)
  const locked = isLocked()

  useEffect(() => { loadPicks(); loadOverrides() }, [])

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
      {/* Status banner */}
      {locked ? (
        <div style={s.lockedBanner}>&#128274; Picks locked — deadline passed Sunday noon PT.</div>
      ) : (
        <div style={s.openBanner}>
          <span>Lock by <strong>Sunday April 20, noon PT</strong></span>
          <span style={{ color: '#5DCAA5', fontWeight: 600 }}>{picksMade}/{totalPickable} picks</span>
        </div>
      )}

      {/* Scrollable bracket */}
      <div style={s.scrollWrap}>
        <div style={s.bracketOuter}>
          <Bracket
            westCols={WEST_COLS} eastCols={EAST_COLS}
            resolveMatchup={resolveMatchup} picks={picks}
            getPickedAbbrev={getPickedAbbrev} onTap={openPopup} locked={locked}
          />
        </div>
      </div>

      {/* Submit */}
      {!locked && (
        <div style={{ padding: '0 16px' }}>
          <button
            style={{ ...s.submitBtn, opacity: picksMade === 0 ? 0.5 : 1 }}
            onClick={submitBracket} disabled={saving || picksMade === 0}>
            {saving ? <span className="spinner" /> : `Submit Bracket  (${picksMade}/${totalPickable})`}
          </button>
          {saved && <div style={s.savedMsg}>&#10003; Bracket saved! Update anytime until Sunday noon PT.</div>}
        </div>
      )}

      {/* Popup */}
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

// ─── BRACKET SVG ────────────────────────────────────────────────────────────

function Bracket({ westCols, eastCols, resolveMatchup, picks, getPickedAbbrev, onTap, locked }) {
  // Layout constants
  const colW = CW + RGAP        // width of one round column including connector
  const matchupH = CH * 2 + GAP // height of one matchup card pair
  const r1Count = 4             // matchups in round 1

  // Total height needed: 4 matchups in R1 with spacing
  const totalH = r1Count * matchupH + (r1Count - 1) * MGAP + 60 // 60 for labels

  // Column x positions (west side): R1, R2, R3
  const wX = [0, colW, colW * 2]
  // Column x positions (east side, mirrored): R3, R2, R1
  const FINAL_X = colW * 3 + 20  // center gap
  const eX = [FINAL_X + CW + RGAP + 20, FINAL_X + CW + RGAP * 2 + CW + 20, FINAL_X + CW + RGAP * 3 + CW * 2 + 20]

  const totalW = eX[2] + CW + 16

  // Compute vertical center of each matchup in each column
  function getMatchupCenters(count, totalHeight) {
    const spacing = totalHeight / count
    return Array.from({ length: count }, (_, i) => 50 + spacing * i + spacing / 2)
  }

  const r1Centers = getMatchupCenters(4, totalH - 50)
  const r2Centers = getMatchupCenters(2, totalH - 50)
  const r3Centers = getMatchupCenters(1, totalH - 50)

  function getCenters(round) {
    if (round === 1) return r1Centers
    if (round === 2) return r2Centers
    return r3Centers
  }

  const LABEL_Y = 18
  const connColor = 'rgba(255,255,255,0.18)'

  return (
    <svg width={totalW} height={totalH + 20} style={{ display: 'block' }}>
      <defs>
        <style>{`
          .card-bg { fill: #1a2f4a; rx: 7; }
          .card-picked { fill: #0d1f35; }
          .team-abbr { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; fill: #fff; }
          .team-abbr-dim { fill: rgba(255,255,255,0.3); }
          .team-abbr-winner { fill: #FFD700; }
          .round-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; fill: #6B8FAD; letter-spacing: 1px; }
          .conf-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; fill: #C8102E; letter-spacing: 2px; }
          .games-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 9px; font-weight: 600; fill: #85B7EB; }
          .final-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 700; fill: #FFD700; letter-spacing: 2px; }
          .tbd-lbl { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; fill: rgba(255,255,255,0.2); }
          .tap-hint { font-family: 'Barlow', sans-serif; font-size: 8px; fill: rgba(255,255,255,0.25); }
        `}</style>
      </defs>

      {/* WEST LABEL */}
      <text x={wX[0] + CW/2} y={LABEL_Y} textAnchor="middle" className="conf-lbl">WEST</text>

      {/* EAST LABEL */}
      <text x={eX[2] + CW/2} y={LABEL_Y} textAnchor="middle" className="conf-lbl">EAST</text>

      {/* FINAL LABEL */}
      <text x={FINAL_X + CW/2} y={LABEL_Y} textAnchor="middle" className="final-lbl">FINAL</text>

      {/* ROUND LABELS — West */}
      {westCols.map((col, ci) => (
        <text key={`wl${ci}`} x={wX[ci] + CW/2} y={34} textAnchor="middle" className="round-lbl">
          {`R${col.round} +${col.pts}pts`}
        </text>
      ))}

      {/* ROUND LABELS — East */}
      {eastCols.map((col, ci) => (
        <text key={`el${ci}`} x={eX[ci] + CW/2} y={34} textAnchor="middle" className="round-lbl">
          {`R${col.round} +${col.pts}pts`}
        </text>
      ))}

      {/* ── WEST CONNECTOR LINES ── */}
      {/* R1→R2 */}
      {[0,1,2,3].map(i => {
        const srcCy = r1Centers[i]
        const destIdx = Math.floor(i / 2)
        const destCy = r2Centers[destIdx]
        const srcX = wX[0] + CW
        const destX = wX[1]
        const midX = srcX + RGAP / 2
        return (
          <g key={`wc1_${i}`}>
            <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
          </g>
        )
      })}
      {/* R2→R3 */}
      {[0,1].map(i => {
        const srcCy = r2Centers[i]
        const destCy = r3Centers[0]
        const srcX = wX[1] + CW
        const destX = wX[2]
        const midX = srcX + RGAP / 2
        return (
          <g key={`wc2_${i}`}>
            <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
          </g>
        )
      })}
      {/* R3→Final */}
      <line x1={wX[2]+CW} y1={r3Centers[0]} x2={FINAL_X} y2={r3Centers[0]} stroke={connColor} strokeWidth="1.5" />

      {/* ── EAST CONNECTOR LINES ── */}
      {/* R1→R2 (east R1 is eX[2], R2 is eX[1]) */}
      {[0,1,2,3].map(i => {
        const srcCy = r1Centers[i]
        const destIdx = Math.floor(i / 2)
        const destCy = r2Centers[destIdx]
        const srcX = eX[2]
        const destX = eX[1] + CW
        const midX = srcX - RGAP / 2
        return (
          <g key={`ec1_${i}`}>
            <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
          </g>
        )
      })}
      {/* R2→R3 */}
      {[0,1].map(i => {
        const srcCy = r2Centers[i]
        const destCy = r3Centers[0]
        const srcX = eX[1]
        const destX = eX[0] + CW
        const midX = srcX - RGAP / 2
        return (
          <g key={`ec2_${i}`}>
            <line x1={srcX} y1={srcCy} x2={midX} y2={srcCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={srcCy} x2={midX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
            <line x1={midX} y1={destCy} x2={destX} y2={destCy} stroke={connColor} strokeWidth="1.5" />
          </g>
        )
      })}
      {/* R3→Final */}
      <line x1={eX[0]} y1={r3Centers[0]} x2={FINAL_X+CW} y2={r3Centers[0]} stroke={connColor} strokeWidth="1.5" />

      {/* ── WEST MATCHUP CARDS ── */}
      {westCols.map((col, ci) =>
        col.ids.map((id, mi) => {
          const cy = getCenters(col.round)[mi]
          return (
            <MatchupCardSVG key={id} id={id} x={wX[ci]} cy={cy}
              resolveMatchup={resolveMatchup} picks={picks}
              getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked} />
          )
        })
      )}

      {/* ── EAST MATCHUP CARDS ── */}
      {eastCols.map((col, ci) =>
        col.ids.map((id, mi) => {
          const cy = getCenters(col.round)[mi]
          return (
            <MatchupCardSVG key={id} id={id} x={eX[ci]} cy={cy}
              resolveMatchup={resolveMatchup} picks={picks}
              getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked} />
          )
        })
      )}

      {/* ── FINAL CARD ── */}
      <FinalCardSVG x={FINAL_X} cy={r3Centers[0]}
        resolveMatchup={resolveMatchup} picks={picks}
        getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked} />
    </svg>
  )
}

// SVG matchup card — two team slots stacked
function MatchupCardSVG({ id, x, cy, resolveMatchup, picks, getPickedAbbrev, onTap, locked }) {
  const m = resolveMatchup(id)
  if (!m) return null
  const pick = picks[id]
  const pickedAbbrev = getPickedAbbrev(id)
  const matchupH = CH * 2 + GAP
  const y = cy - matchupH / 2

  const bothTBD = !m.a1 && !m.a2
  const canTap = !locked && !bothTBD

  return (
    <g style={{ cursor: canTap ? 'pointer' : 'default' }} onClick={() => canTap && onTap(id)}>
      {/* Team 1 card */}
      <TeamCardSVG x={x} y={y} abbrev={m.a1} isPicked={pickedAbbrev === m.a1} isLoser={!!pickedAbbrev && pickedAbbrev !== m.a1} games={pickedAbbrev === m.a1 ? pick?.games : null} />
      {/* Team 2 card */}
      <TeamCardSVG x={x} y={y + CH + GAP} abbrev={m.a2} isPicked={pickedAbbrev === m.a2} isLoser={!!pickedAbbrev && pickedAbbrev !== m.a2} games={pickedAbbrev === m.a2 ? pick?.games : null} />
      {/* Tap hint if no pick */}
      {!pickedAbbrev && canTap && (
        <text x={x + CW/2} y={y + matchupH + 10} textAnchor="middle" className="tap-hint">tap to pick</text>
      )}
    </g>
  )
}

function TeamCardSVG({ x, y, abbrev, isPicked, isLoser, games }) {
  const isTBD = !abbrev || abbrev === 'TBD' || abbrev === '???'
  const opacity = isLoser ? 0.3 : 1

  return (
    <g opacity={opacity}>
      {/* Card background */}
      <rect x={x} y={y} width={CW} height={CH} rx="7"
        fill={isPicked ? '#0d2d1a' : '#1a2f4a'}
        stroke={isPicked ? '#1D9E75' : 'rgba(255,255,255,0.12)'}
        strokeWidth={isPicked ? 2 : 1} />

      {isTBD ? (
        <text x={x + CW/2} y={y + CH/2 + 5} textAnchor="middle" className="tbd-lbl">?</text>
      ) : (
        <>
          {/* Team logo via foreignObject for img tag */}
          <foreignObject x={x + 4} y={y + 4} width={CW - 8} height={CH - (games ? 18 : 8)}>
            <div xmlns="http://www.w3.org/1999/xhtml"
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={NHL_LOGO(abbrev)} alt={abbrev}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: isLoser ? 'grayscale(100%)' : 'none' }}
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.parentNode.innerHTML = `<span style="font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:white;">${abbrev}</span>`
                }}
              />
            </div>
          </foreignObject>
          {/* Games badge */}
          {games && (
            <>
              <rect x={x + 4} y={y + CH - 16} width={CW - 8} height={13} rx="4"
                fill="rgba(55,138,221,0.25)" stroke="rgba(55,138,221,0.4)" strokeWidth="1" />
              <text x={x + CW/2} y={y + CH - 6} textAnchor="middle" className="games-lbl">in {games}</text>
            </>
          )}
          {/* Winner glow dot */}
          {isPicked && (
            <circle cx={x + CW - 8} cy={y + 8} r={4} fill="#1D9E75" />
          )}
        </>
      )}
    </g>
  )
}

// Final card — shows West winner (top) vs East winner (bottom)
function FinalCardSVG({ x, cy, resolveMatchup, picks, getPickedAbbrev, onTap, locked }) {
  const m = resolveMatchup('f1')
  if (!m) return null
  const matchupH = CH * 2 + GAP + 24
  const y = cy - matchupH / 2
  const pickedAbbrev = getPickedAbbrev('f1')
  const pick = picks['f1']
  const bothTBD = !m.a1 && !m.a2
  const canTap = !locked && !bothTBD

  return (
    <g style={{ cursor: canTap ? 'pointer' : 'default' }} onClick={() => canTap && onTap('f1')}>
      <TeamCardSVG x={x} y={y + 20} abbrev={m.a1} isPicked={pickedAbbrev === m.a1} isLoser={!!pickedAbbrev && pickedAbbrev !== m.a1} games={pickedAbbrev === m.a1 ? pick?.games : null} />
      <text x={x + CW/2} y={y + 20 + CH + GAP/2 + 4} textAnchor="middle" style={{ fontSize: 10, fill: '#6B8FAD', fontFamily: 'Barlow Condensed' }}>vs</text>
      <TeamCardSVG x={x} y={y + 20 + CH + GAP + 12} abbrev={m.a2} isPicked={pickedAbbrev === m.a2} isLoser={!!pickedAbbrev && pickedAbbrev !== m.a2} games={pickedAbbrev === m.a2 ? pick?.games : null} />
    </g>
  )
}

// ─── POPUP ───────────────────────────────────────────────────────────────────

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
                style={{ ...s.teamBtn, borderColor: sel ? '#1D9E75' : 'rgba(255,255,255,0.12)', background: sel ? 'rgba(29,158,117,0.15)' : '#0d1f35', opacity: isTBD ? 0.35 : 1 }}
                onClick={() => !isTBD && onTeam(slot)} disabled={isTBD}>
                {!isTBD ? (
                  <img src={NHL_LOGO(abbrev)} alt={abbrev} style={s.popupLogo}
                    onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
                ) : (
                  <div style={s.tbdCircle}>?</div>
                )}
                <div style={{ display: 'none', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 700, color: 'white' }}>{abbrev}</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, marginTop: 8, color: sel ? 'white' : '#A0B4CC' }}>
                  {isTBD ? 'TBD' : abbrev}
                </div>
                <div style={{ fontSize: 11, color: '#6B8FAD', marginTop: 2 }}>{isTBD ? '—' : name?.split(' ').pop()}</div>
                {sel && <div style={s.selCheck}>✓</div>}
              </button>
            )
          })}
        </div>

        <div style={{ ...s.sectionLabel, marginTop: 20 }}>Series length?</div>
        <div style={s.gamesGrid}>
          {[4,5,6,7].map(g => (
            <button key={g}
              style={{ ...s.gamesBtn, borderColor: selectedGames===g ? '#378ADD' : 'rgba(255,255,255,0.12)', background: selectedGames===g ? 'rgba(55,138,221,0.2)' : '#0d1f35', color: selectedGames===g ? '#85B7EB' : '#6B8FAD' }}
              onClick={() => onGames(g)}>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 700, display: 'block' }}>{g}</span>
              <span style={{ fontSize: 10 }}>games</span>
            </button>
          ))}
        </div>

        <button style={{ ...s.confirmBtn, opacity: canConfirm ? 1 : 0.4, marginTop: 20 }}
          onClick={canConfirm ? onConfirm : undefined} disabled={!canConfirm}>
          {canConfirm ? '✓  Confirm Pick' : 'Select a team and series length'}
        </button>
      </div>
    </div>
  )
}

const s = {
  lockedBanner: { margin: '0 16px 12px', background: 'rgba(200,16,46,0.1)', border: '1px solid rgba(200,16,46,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#FFB3C0' },
  openBanner: { margin: '0 16px 12px', background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#5DCAA5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  scrollWrap: { overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 12px 12px' },
  bracketOuter: { display: 'inline-block', minWidth: '100%' },
  submitBtn: { width: '100%', marginTop: 16, padding: '14px', background: '#C8102E', color: 'white', border: 'none', borderRadius: 10, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savedMsg: { textAlign: 'center', color: '#1D9E75', fontSize: 13, marginTop: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(2,15,33,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400 },
  modal: { background: '#0d1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 500 },
  modalTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700 },
  modalSub: { fontSize: 12, color: '#6B8FAD', marginTop: 2 },
  closeBtn: { background: 'transparent', border: 'none', color: '#A0B4CC', fontSize: 22, cursor: 'pointer', padding: 4 },
  sectionLabel: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 600, color: '#6B8FAD', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  teamGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  teamBtn: { padding: '16px 8px', borderRadius: 12, border: '2px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' },
  popupLogo: { width: 64, height: 64, objectFit: 'contain' },
  tbdCircle: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#6B8FAD' },
  selCheck: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, background: '#1D9E75', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white' },
  gamesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  gamesBtn: { padding: '12px 6px', borderRadius: 10, border: '1px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' },
  confirmBtn: { width: '100%', padding: '14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: 10, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' },
}
