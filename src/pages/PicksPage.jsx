import { useEffect, useState } from 'react'
import { supabase, ROUNDS, ROUND_POINTS, PICKS_DEADLINE } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const isLocked = () => new Date() > PICKS_DEADLINE
const NHL_LOGO = (abbrev) => `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`

// Bracket structure: which R1 matchups feed into which R2, R3, Final slots
// Each entry: { id, feedsInto, slot } — slot = 't1' or 't2' of the parent matchup
const BRACKET_FEED = {
  e1: { feedsInto: 'e5', slot: 't1' },
  e2: { feedsInto: 'e6', slot: 't1' },
  e3: { feedsInto: 'e5', slot: 't2' },  // e1 winner vs e3 winner
  e4: { feedsInto: 'e6', slot: 't2' },
  e5: { feedsInto: 'e7', slot: 't1' },
  e6: { feedsInto: 'e7', slot: 't2' },
  e7: { feedsInto: 'f1', slot: 't1' },
  w1: { feedsInto: 'w5', slot: 't1' },
  w2: { feedsInto: 'w6', slot: 't1' },
  w3: { feedsInto: 'w5', slot: 't2' },
  w4: { feedsInto: 'w6', slot: 't2' },
  w5: { feedsInto: 'w7', slot: 't1' },
  w6: { feedsInto: 'w7', slot: 't2' },
  w7: { feedsInto: 'f1', slot: 't2' },
}

// For each matchup, which two source matchups feed team1 and team2
const MATCHUP_SOURCES = {
  e5: { t1: 'e1', t2: 'e3' },
  e6: { t1: 'e2', t2: 'e4' },
  e7: { t1: 'e5', t2: 'e6' },
  w5: { t1: 'w1', t2: 'w3' },
  w6: { t1: 'w2', t2: 'w4' },
  w7: { t1: 'w5', t2: 'w6' },
  f1: { t1: 'e7', t2: 'w7' },
}

export default function PicksPage() {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})
  const [overrides, setOverrides] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [popup, setPopup] = useState(null) // { matchupId, m } — current open matchup
  const [popupTeam, setPopupTeam] = useState(null) // 't1' or 't2'
  const [popupGames, setPopupGames] = useState(null) // 4-7
  const locked = isLocked()

  useEffect(() => {
    loadPicks()
    loadOverrides()
  }, [])

  async function loadPicks() {
    const { data } = await supabase
      .from('picks').select('matchup_id, team, games').eq('user_id', user.id)
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

  // Merge overrides into base matchup data
  function getMatchup(id) {
    const round = ROUNDS.find(r => r.matchups.find(m => m.id === id))
    const base = round?.matchups.find(m => m.id === id)
    if (!base) return null
    const ov = overrides[id]
    if (!ov) return base
    return { ...base, t1: ov.t1 || base.t1, a1: ov.a1 || base.a1, t2: ov.t2 || base.t2, a2: ov.a2 || base.a2 }
  }

  // Resolve what team is in a given slot of a matchup based on picks cascading up
  function resolveTeam(matchupId, slot) {
    const sources = MATCHUP_SOURCES[matchupId]
    if (!sources) {
      // Round 1 — team comes directly from matchup data
      const m = getMatchup(matchupId)
      return slot === 't1' ? { abbrev: m?.a1, name: m?.t1 } : { abbrev: m?.a2, name: m?.t2 }
    }
    // Higher round — team comes from the pick made in the source matchup
    const sourceMatchupId = sources[slot]
    const sourcePick = picks[sourceMatchupId]
    if (!sourcePick?.team) return null // not picked yet
    const sourceM = resolveMatchup(sourceMatchupId)
    if (!sourceM) return null
    return sourcePick.team === 't1'
      ? { abbrev: sourceM.a1, name: sourceM.t1 }
      : { abbrev: sourceM.a2, name: sourceM.t2 }
  }

  // Resolve a full matchup with cascaded team info
  function resolveMatchup(id) {
    const base = getMatchup(id)
    if (!base) return null
    const sources = MATCHUP_SOURCES[id]
    if (!sources) return base // R1 — use direct data
    const t1 = resolveTeam(id, 't1')
    const t2 = resolveTeam(id, 't2')
    return {
      ...base,
      t1: t1?.name || 'TBD', a1: t1?.abbrev || null,
      t2: t2?.name || 'TBD', a2: t2?.abbrev || null,
    }
  }

  // Get the picked winner abbrev for a matchup
  function getPickedAbbrev(matchupId) {
    const pick = picks[matchupId]
    if (!pick?.team) return null
    const m = resolveMatchup(matchupId)
    return pick.team === 't1' ? m?.a1 : m?.a2
  }

  function openPopup(matchupId) {
    if (locked) return
    const m = resolveMatchup(matchupId)
    if (!m) return
    // Don't open if both teams are TBD
    if (!m.a1 && !m.a2) return
    const existing = picks[matchupId]
    setPopupTeam(existing?.team || null)
    setPopupGames(existing?.games || null)
    setPopup({ matchupId, m })
  }

  function confirmPick() {
    if (!popupTeam || !popupGames || !popup) return
    setPicks(p => ({ ...p, [popup.matchupId]: { team: popupTeam, games: popupGames } }))
    setPopup(null)
    setPopupTeam(null)
    setPopupGames(null)
  }

  async function submitBracket() {
    setSaving(true)
    const rows = Object.entries(picks).map(([matchup_id, pick]) => ({
      user_id: user.id, matchup_id, team: pick.team || null, games: pick.games || null,
    }))
    await supabase.from('picks').upsert(rows, { onConflict: 'user_id,matchup_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 4000)
  }

  // Count total picks made
  const totalPickable = 15 // 8 + 4 + 2 + 1
  const picksMade = Object.keys(picks).filter(id => picks[id]?.team && picks[id]?.games).length

  const eastR1 = ['e1', 'e2', 'e3', 'e4']
  const westR1 = ['w1', 'w2', 'w3', 'w4']
  const eastR2 = ['e5', 'e6']
  const westR2 = ['w5', 'w6']
  const eastCF = ['e7']
  const westCF = ['w7']
  const final = ['f1']

  const round1Pts = ROUND_POINTS[1]
  const round2Pts = ROUND_POINTS[2]
  const round3Pts = ROUND_POINTS[3]
  const round4Pts = ROUND_POINTS[4]

  return (
    <div style={{ padding: '16px 0 48px', maxWidth: 900, margin: '0 auto' }}>

      {locked ? (
        <div style={s.lockedBanner}>&#128274; Picks are locked — deadline passed Sunday noon PT.</div>
      ) : (
        <div style={s.openBanner}>
          <span>Picks open — lock by <strong>Sunday April 20, noon PT</strong></span>
          <span style={{ fontSize: 13, color: '#5DCAA5', fontWeight: 600 }}>{picksMade}/{totalPickable} picks made</span>
        </div>
      )}

      {/* BRACKET */}
      <div style={s.bracketWrap}>

        {/* EAST LABEL */}
        <div style={s.confTitle}>Eastern Conference</div>

        {/* EAST BRACKET ROW */}
        <div style={s.bracketRow}>
          <BracketColumn ids={eastR1} resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} onTap={openPopup} label={`R1 · +${round1Pts}pts`} locked={locked} />
          <BracketColumn ids={eastR2} resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} onTap={openPopup} label={`R2 · +${round2Pts}pts`} locked={locked} center />
          <BracketColumn ids={eastCF} resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} onTap={openPopup} label={`CF · +${round3Pts}pts`} locked={locked} center />
          <FinalColumn id="f1" slot="t1" resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} label={`SCF · +${round4Pts}pts`} onTap={openPopup} locked={locked} />
        </div>

        {/* FINAL DIVIDER */}
        <div style={s.finalDivider}>
          <div style={s.cupIcon}>🏆</div>
          <div style={s.finalLabel}>Stanley Cup Final</div>
        </div>

        {/* WEST BRACKET ROW */}
        <div style={s.bracketRow}>
          <BracketColumn ids={westR1} resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} onTap={openPopup} label={`R1 · +${round1Pts}pts`} locked={locked} />
          <BracketColumn ids={westR2} resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} onTap={openPopup} label={`R2 · +${round2Pts}pts`} locked={locked} center />
          <BracketColumn ids={westCF} resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} onTap={openPopup} label={`CF · +${round3Pts}pts`} locked={locked} center />
          <FinalColumn id="f1" slot="t2" resolveMatchup={resolveMatchup} picks={picks} getPickedAbbrev={getPickedAbbrev} label="" onTap={openPopup} locked={locked} />
        </div>

        {/* WEST LABEL */}
        <div style={{ ...s.confTitle, marginTop: 4 }}>Western Conference</div>
      </div>

      {/* SUBMIT */}
      {!locked && (
        <div style={{ padding: '0 16px' }}>
          <button style={{ ...s.submitBtn, opacity: picksMade === 0 ? 0.5 : 1 }} onClick={submitBracket} disabled={saving || picksMade === 0}>
            {saving ? <span className="spinner" /> : `Submit Bracket (${picksMade}/${totalPickable} picks)`}
          </button>
          {saved && <div style={s.savedMsg}>&#10003; Bracket saved! You can update until Sunday noon PT.</div>}
        </div>
      )}

      {/* PICK POPUP */}
      {popup && (
        <PickPopup
          m={popup.m}
          matchupId={popup.matchupId}
          selectedTeam={popupTeam}
          selectedGames={popupGames}
          onTeam={setPopupTeam}
          onGames={setPopupGames}
          onConfirm={confirmPick}
          onClose={() => setPopup(null)}
          round={ROUNDS.find(r => r.matchups.find(m => m.id === popup.matchupId))?.id || 1}
        />
      )}
    </div>
  )
}

// A vertical column of matchup cards for a given round
function BracketColumn({ ids, resolveMatchup, picks, getPickedAbbrev, onTap, label, locked, center }) {
  return (
    <div style={{ ...s.column, alignItems: center ? 'center' : 'flex-start' }}>
      <div style={s.roundLabel}>{label}</div>
      {ids.map(id => (
        <MatchupCard key={id} id={id} resolveMatchup={resolveMatchup} picks={picks}
          getPickedAbbrev={getPickedAbbrev} onTap={onTap} locked={locked} />
      ))}
    </div>
  )
}

// Special column just for the Final — shows one slot (East winner or West winner)
function FinalColumn({ id, slot, resolveMatchup, picks, getPickedAbbrev, onTap, label, locked }) {
  const m = resolveMatchup(id)
  const pick = picks[id]
  const pickedAbbrev = getPickedAbbrev(id)
  const abbrev = slot === 't1' ? m?.a1 : m?.a2
  const isChampion = pickedAbbrev && pickedAbbrev === abbrev
  const hasPick = !!abbrev

  return (
    <div style={{ ...s.column, alignItems: 'center' }}>
      {label && <div style={s.roundLabel}>{label}</div>}
      <div style={{ ...s.finalSlot, borderColor: isChampion ? '#FFD700' : 'rgba(255,255,255,0.15)', background: isChampion ? 'rgba(255,215,0,0.1)' : '#051F3E' }}
        onClick={() => !locked && onTap(id)}>
        {hasPick ? (
          <>
            <img src={`https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`} style={s.finalLogo} alt={abbrev}
              onError={e => { e.target.style.display = 'none' }} />
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: isChampion ? '#FFD700' : '#A0B4CC' }}>{abbrev}</div>
            {isChampion && pick?.games && <div style={{ fontSize: 10, color: '#FFD700', marginTop: 2 }}>in {pick.games}</div>}
          </>
        ) : (
          <div style={s.tbdSlot}>?</div>
        )}
      </div>
    </div>
  )
}

// Individual matchup card — shows two teams, tap to pick
function MatchupCard({ id, resolveMatchup, picks, getPickedAbbrev, onTap, locked }) {
  const m = resolveMatchup(id)
  if (!m) return null
  const pick = picks[id]
  const pickedAbbrev = getPickedAbbrev(id)
  const hasPick = !!pickedAbbrev
  const bothTBD = !m.a1 && !m.a2

  return (
    <div style={{ ...s.matchupCard, cursor: locked || bothTBD ? 'default' : 'pointer' }}
      onClick={() => !locked && !bothTBD && onTap(id)}>

      <TeamSlot abbrev={m.a1} isPicked={pickedAbbrev === m.a1} isLoser={hasPick && pickedAbbrev !== m.a1} />
      <div style={s.vsLine}>
        {hasPick && pick?.games ? (
          <div style={s.gamesChip}>in {pick.games}</div>
        ) : (
          <div style={s.vsDot} />
        )}
      </div>
      <TeamSlot abbrev={m.a2} isPicked={pickedAbbrev === m.a2} isLoser={hasPick && pickedAbbrev !== m.a2} />

      {!hasPick && !bothTBD && !locked && (
        <div style={s.tapHint}>tap to pick</div>
      )}
    </div>
  )
}

function TeamSlot({ abbrev, isPicked, isLoser }) {
  if (!abbrev || abbrev === 'TBD' || abbrev === '???' || abbrev === 'TBD') {
    return <div style={s.tbdLogoSlot}><div style={s.tbdCircle}>?</div></div>
  }
  return (
    <div style={{ ...s.logoSlot, opacity: isLoser ? 0.3 : 1 }}>
      <div style={{ ...s.logoWrap, background: isPicked ? 'rgba(200,16,46,0.15)' : 'transparent', borderColor: isPicked ? '#C8102E' : 'transparent' }}>
        <img src={`https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`}
          style={s.logo} alt={abbrev}
          onError={e => { e.target.replaceWith(Object.assign(document.createElement('div'), { textContent: abbrev, style: 'font-size:10px;color:#A0B4CC;font-weight:700;font-family:Barlow Condensed,sans-serif;' })) }}
        />
      </div>
      {isPicked && <div style={s.pickedDot} />}
    </div>
  )
}

// Popup modal for picking winner + games
function PickPopup({ m, matchupId, selectedTeam, selectedGames, onTeam, onGames, onConfirm, onClose, round }) {
  const pts = ROUND_POINTS[round] || 5
  const canConfirm = selectedTeam && selectedGames
  const bothTBD = !m.a1 && !m.a2

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>
            Round {round} Pick
          </div>
          <div style={{ fontSize: 12, color: '#6B8FAD' }}>+{pts} pts each</div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {/* Team picker */}
        <div style={s.modalSection}>
          <div style={s.modalSectionLabel}>Who wins this series?</div>
          <div style={s.teamPicker}>
            {[{ slot: 't1', abbrev: m.a1, name: m.t1 }, { slot: 't2', abbrev: m.a2, name: m.t2 }].map(({ slot, abbrev, name }) => {
              const isTBD = !abbrev || abbrev === 'TBD' || abbrev === '???'
              const isSelected = selectedTeam === slot
              return (
                <button key={slot}
                  style={{ ...s.teamPickBtn, borderColor: isSelected ? '#C8102E' : 'rgba(255,255,255,0.15)', background: isSelected ? 'rgba(200,16,46,0.15)' : 'transparent', opacity: isTBD ? 0.4 : 1 }}
                  onClick={() => !isTBD && onTeam(slot)}
                  disabled={isTBD}>
                  {!isTBD ? (
                    <img src={`https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`}
                      style={s.popupLogo} alt={abbrev}
                      onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <div style={s.tbdPopupCircle}>?</div>
                  )}
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, marginTop: 6, color: isSelected ? 'white' : '#A0B4CC' }}>
                    {isTBD ? 'TBD' : abbrev}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B8FAD', marginTop: 2, lineHeight: 1.3 }}>
                    {isTBD ? '—' : name?.split(' ').pop()}
                  </div>
                  {isSelected && <div style={s.selectedCheck}>✓</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Games picker */}
        <div style={s.modalSection}>
          <div style={s.modalSectionLabel}>How many games?</div>
          <div style={s.gamesPicker}>
            {[4, 5, 6, 7].map(g => (
              <button key={g}
                style={{ ...s.gamesBtn, borderColor: selectedGames === g ? '#378ADD' : 'rgba(255,255,255,0.15)', background: selectedGames === g ? 'rgba(55,138,221,0.2)' : 'transparent', color: selectedGames === g ? '#85B7EB' : '#A0B4CC' }}
                onClick={() => onGames(g)}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26, fontWeight: 700 }}>{g}</div>
                <div style={{ fontSize: 10, marginTop: 2 }}>games</div>
              </button>
            ))}
          </div>
        </div>

        <button style={{ ...s.confirmBtn, opacity: canConfirm ? 1 : 0.4 }}
          onClick={canConfirm ? onConfirm : undefined}
          disabled={!canConfirm}>
          {canConfirm ? 'Confirm Pick' : 'Pick a team and series length'}
        </button>
      </div>
    </div>
  )
}

const s = {
  lockedBanner: { margin: '0 16px 16px', background: 'rgba(200,16,46,0.1)', border: '1px solid rgba(200,16,46,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#FFB3C0', display: 'flex', alignItems: 'center', gap: 10 },
  openBanner: { margin: '0 16px 16px', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#5DCAA5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },

  bracketWrap: { padding: '0 8px', overflowX: 'auto' },
  confTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: 2, textTransform: 'uppercase', padding: '8px 8px 4px', },
  bracketRow: { display: 'flex', gap: 4, alignItems: 'flex-start', padding: '4px 0' },

  column: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 },
  roundLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 600, color: '#6B8FAD', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginBottom: 2, whiteSpace: 'nowrap' },

  matchupCard: {
    background: '#051F3E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '8px 6px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4,
    transition: 'border-color 0.15s',
    minWidth: 64,
  },

  logoSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative' },
  logoWrap: { width: 40, height: 40, borderRadius: 8, border: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', padding: 4 },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  pickedDot: { width: 5, height: 5, background: '#C8102E', borderRadius: '50%' },

  tbdLogoSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tbdCircle: { width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6B8FAD' },

  vsLine: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  vsDot: { width: 4, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: '50%' },
  gamesChip: { background: 'rgba(55,138,221,0.2)', border: '1px solid rgba(55,138,221,0.3)', borderRadius: 10, padding: '2px 6px', fontSize: 10, color: '#85B7EB', fontWeight: 600, whiteSpace: 'nowrap' },
  tapHint: { fontSize: 9, color: '#6B8FAD', marginTop: 2, letterSpacing: 0.5 },

  finalSlot: { width: 56, height: 90, borderRadius: 10, border: '2px solid', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6, cursor: 'pointer', transition: 'all 0.2s' },
  finalLogo: { width: 36, height: 36, objectFit: 'contain' },
  tbdSlot: { fontSize: 20, color: '#6B8FAD' },

  finalDivider: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 0 8px', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '4px 8px' },
  cupIcon: { fontSize: 20 },
  finalLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: '#FFD700', letterSpacing: 2, textTransform: 'uppercase' },

  submitBtn: { width: '100%', marginTop: 20, padding: '14px', background: '#C8102E', color: 'white', border: 'none', borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savedMsg: { textAlign: 'center', color: '#1D9E75', fontSize: 13, marginTop: 10 },

  // Popup styles
  overlay: { position: 'fixed', inset: 0, background: 'rgba(2,15,33,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400, padding: 0 },
  modal: { background: '#051F3E', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  closeBtn: { marginLeft: 'auto', background: 'transparent', border: 'none', color: '#A0B4CC', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 },
  modalSection: { marginBottom: 20 },
  modalSectionLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 600, color: '#6B8FAD', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },

  teamPicker: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  teamPickBtn: { padding: '14px 8px', borderRadius: 12, border: '2px solid', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' },
  popupLogo: { width: 56, height: 56, objectFit: 'contain' },
  tbdPopupCircle: { width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#6B8FAD' },
  selectedCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, background: '#C8102E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' },

  gamesPicker: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  gamesBtn: { padding: '12px 6px', borderRadius: 10, border: '1px solid', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s' },

  confirmBtn: { width: '100%', padding: '14px', background: '#C8102E', color: 'white', border: 'none', borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', transition: 'opacity 0.2s' },
}
