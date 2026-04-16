import { useEffect, useState } from 'react'
import { supabase, ROUNDS, ROUND_POINTS, PICKS_DEADLINE } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const isLocked = () => new Date() > PICKS_DEADLINE

export default function PicksPage() {
  const { user } = useAuth()
  const [picks, setPicks] = useState({})
  const [results, setResults] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeRound, setActiveRound] = useState(1)
  const locked = isLocked()

  useEffect(() => {
    loadPicks()
    loadResults()
  }, [])

  async function loadPicks() {
    const { data } = await supabase
      .from('picks')
      .select('matchup_id, team, games')
      .eq('user_id', user.id)
    if (data) {
      const obj = {}
      data.forEach(p => { obj[p.matchup_id] = { team: p.team, games: p.games } })
      setPicks(obj)
    }
  }

  async function loadResults() {
    const { data } = await supabase.from('results').select('*')
    if (data) {
      const obj = {}
      data.forEach(r => { obj[r.matchup_id] = r })
      setResults(obj)
    }
  }

  function selTeam(matchupId, team) {
    if (locked) return
    setPicks(p => ({ ...p, [matchupId]: { ...p[matchupId], team } }))
  }

  function selGames(matchupId, games) {
    if (locked) return
    setPicks(p => ({ ...p, [matchupId]: { ...p[matchupId], games } }))
  }

  async function savePicks() {
    if (locked) return
    setSaving(true)
    const rows = Object.entries(picks).map(([matchup_id, pick]) => ({
      user_id: user.id,
      matchup_id,
      team: pick.team || null,
      games: pick.games || null,
    }))
    await supabase.from('picks').upsert(rows, { onConflict: 'user_id,matchup_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Determine which rounds are unlocked
  // Round 1 always open; subsequent rounds open when admin unlocks them via results
  const unlockedRounds = ROUNDS.map(r => {
    if (r.id === 1) return true
    // Round N unlocks if all round N-1 results are entered
    const prevRound = ROUNDS.find(x => x.id === r.id - 1)
    return prevRound?.matchups.every(m => results[m.id]) ?? false
  })

  return (
    <div className="page-wrap fade-up">
      {locked ? (
        <div style={s.lockedBanner}>
          <span style={{ fontSize: 16 }}>&#128274;</span>
          Picks are locked. The deadline passed on Sunday April 20 at noon PT.
        </div>
      ) : (
        <div style={s.openBanner}>
          <span style={{ fontSize: 16 }}>&#9199;</span>
          Picks are open. Last chance to change: <strong>Sunday April 20 at noon PT</strong>.
        </div>
      )}

      {/* Round tabs */}
      <div style={s.roundTabs}>
        {ROUNDS.map((r, i) => (
          <button
            key={r.id}
            style={{
              ...s.roundTab,
              ...(activeRound === r.id ? s.roundTabActive : {}),
              ...(unlockedRounds[i] ? {} : s.roundTabLocked),
            }}
            onClick={() => unlockedRounds[i] && setActiveRound(r.id)}
          >
            R{r.id}
            {!unlockedRounds[i] && <span style={{ marginLeft: 4, fontSize: 10 }}>&#128274;</span>}
          </button>
        ))}
      </div>

      {ROUNDS.map((round, ri) => {
        if (round.id !== activeRound) return null
        const unlocked = unlockedRounds[ri]
        const pts = ROUND_POINTS[round.id]

        const eastMatchups = round.matchups.filter(m => m.conf === 'East')
        const westMatchups = round.matchups.filter(m => m.conf === 'West')
        const finalMatchups = round.matchups.filter(m => m.conf === 'Final')

        return (
          <div key={round.id}>
            <div className="section-label">{round.label} &mdash; {pts} pts per pick</div>

            {!unlocked && (
              <div style={s.futureRound}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: '#A0B4CC' }}>
                  Unlocks after previous round results are entered
                </div>
              </div>
            )}

            {unlocked && round.confLabel && eastMatchups.length > 0 && (
              <>
                <div style={s.confLabel}>Eastern Conference</div>
                {eastMatchups.map(m => (
                  <MatchupCard key={m.id} m={m} pick={picks[m.id]} result={results[m.id]}
                    onTeam={t => selTeam(m.id, t)} onGames={g => selGames(m.id, g)} locked={locked} pts={pts} />
                ))}
                <div style={s.confLabel}>Western Conference</div>
                {westMatchups.map(m => (
                  <MatchupCard key={m.id} m={m} pick={picks[m.id]} result={results[m.id]}
                    onTeam={t => selTeam(m.id, t)} onGames={g => selGames(m.id, g)} locked={locked} pts={pts} />
                ))}
              </>
            )}

            {unlocked && !round.confLabel && round.matchups.map(m => (
              <MatchupCard key={m.id} m={m} pick={picks[m.id]} result={results[m.id]}
                onTeam={t => selTeam(m.id, t)} onGames={g => selGames(m.id, g)} locked={locked} pts={pts} />
            ))}

            {unlocked && !locked && (
              <>
                <button style={s.saveBtn} onClick={savePicks} disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Save My Picks'}
                </button>
                {saved && <div style={s.savedMsg}>&#10003; Picks saved!</div>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MatchupCard({ m, pick, result, onTeam, onGames, locked, pts }) {
  const isCompleted = !!result
  const correctTeamAbbr = result?.winner
  const pickedAbbr = pick?.team === 't1' ? m.a1 : pick?.team === 't2' ? m.a2 : null

  const teamCorrect = pickedAbbr && pickedAbbr === correctTeamAbbr
  const gamesCorrect = pick?.games && result && pick.games === result.games

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 11 }}>
        <span style={{ color: '#6B8FAD' }}>
          {m.t1 !== 'TBD' ? `${m.a1} vs ${m.a2}` : 'TBD — awaiting previous round'}
        </span>
        <span style={{ color: '#C8102E', fontWeight: 600 }}>+{pts} pts each</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 1fr', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TeamBtn
          abbr={m.a1} name={m.t1} seed={m.s1}
          selected={pick?.team === 't1'}
          winner={correctTeamAbbr === m.a1}
          isResult={isCompleted}
          onClick={() => onTeam('t1')}
          disabled={locked || m.t1 === 'TBD'}
        />
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#6B8FAD', textAlign: 'center' }}>VS</div>
        <TeamBtn
          abbr={m.a2} name={m.t2} seed={m.s2}
          selected={pick?.team === 't2'}
          winner={correctTeamAbbr === m.a2}
          isResult={isCompleted}
          onClick={() => onTeam('t2')}
          disabled={locked || m.t2 === 'TBD'}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#A0B4CC', whiteSpace: 'nowrap' }}>Games:</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {[4, 5, 6, 7].map(g => (
            <button key={g}
              style={{
                width: 34, height: 30, borderRadius: 6, fontSize: 13, fontWeight: 500,
                border: pick?.games === g ? '1px solid #378ADD' : '1px solid rgba(255,255,255,0.15)',
                background: pick?.games === g ? 'rgba(55,138,221,0.2)' : 'transparent',
                color: pick?.games === g ? '#85B7EB' : '#A0B4CC',
                cursor: locked ? 'default' : 'pointer',
                outline: result?.games === g ? '2px solid #1D9E75' : 'none',
              }}
              onClick={() => !locked && onGames(g)}
            >{g}</button>
          ))}
        </div>
        {isCompleted && (
          <span style={{ fontSize: 11, color: gamesCorrect ? '#1D9E75' : '#6B8FAD', marginLeft: 4 }}>
            {gamesCorrect ? '&#10003; +' + pts + ' pts' : `Ended in ${result.games}`}
          </span>
        )}
      </div>

      {isCompleted && (
        <div style={{ marginTop: 10, fontSize: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, color: '#A0B4CC' }}>
          Result: <strong style={{ color: 'white' }}>{correctTeamAbbr}</strong> in {result.games} games
          {teamCorrect && <span style={{ color: '#1D9E75', marginLeft: 8 }}>&#10003; +{pts} pts (team)</span>}
        </div>
      )}
    </div>
  )
}

function TeamBtn({ abbr, name, seed, selected, winner, isResult, onClick, disabled }) {
  const lastName = name?.split(' ').pop() || name
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      style={{
        padding: '10px 8px', borderRadius: 8, textAlign: 'center',
        border: winner && isResult ? '1px solid #1D9E75'
              : selected ? '1px solid #C8102E'
              : '1px solid rgba(255,255,255,0.15)',
        background: winner && isResult ? 'rgba(29,158,117,0.15)'
                  : selected ? '#C8102E'
                  : 'transparent',
        color: 'white', cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 10, color: selected ? 'rgba(255,255,255,0.7)' : '#A0B4CC', marginBottom: 3 }}>{seed} seed</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700 }}>{abbr}</div>
      <div style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.8)' : '#A0B4CC', marginTop: 2 }}>{lastName}</div>
    </button>
  )
}

const s = {
  lockedBanner: {
    background: 'rgba(200,16,46,0.1)', border: '1px solid rgba(200,16,46,0.25)',
    borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#FFB3C0',
    marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
  },
  openBanner: {
    background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)',
    borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#5DCAA5',
    marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
  },
  roundTabs: { display: 'flex', gap: 6, marginBottom: 20 },
  roundTab: {
    padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
    color: '#A0B4CC', cursor: 'pointer',
  },
  roundTabActive: { background: '#C8102E', borderColor: '#C8102E', color: 'white' },
  roundTabLocked: { opacity: 0.5, cursor: 'not-allowed' },
  confLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
    color: '#6B8FAD', margin: '16px 0 8px',
  },
  futureRound: {
    background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 20, textAlign: 'center', marginBottom: 10,
  },
  saveBtn: {
    width: '100%', marginTop: 20, padding: 14,
    background: '#C8102E', color: 'white', border: 'none', borderRadius: 10,
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700,
    letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  savedMsg: { textAlign: 'center', color: '#1D9E75', fontSize: 13, marginTop: 8 },
}
