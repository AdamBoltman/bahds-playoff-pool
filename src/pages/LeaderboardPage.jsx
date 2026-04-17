import { useEffect, useState } from 'react'
import { supabase, ROUNDS, PICKS_DEADLINE, ROUND_POINTS } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const ALL_MATCHUPS = ROUNDS.flatMap(r => r.matchups.map(m => ({ ...m, round: r.id })))
const deadlinePassed = () => new Date() > PICKS_DEADLINE

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [myBreakdown, setMyBreakdown] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [allPicks, setAllPicks] = useState([])
  const [results, setResults] = useState({})
  const [fieldStats, setFieldStats] = useState({})
  const locked = deadlinePassed()

  useEffect(() => { load() }, [])

  async function load() {
    const [scoresRes, picksRes, resultsRes] = await Promise.all([
      supabase.from('scores').select('user_id, display_name, r1, r2, r3, r4, total').order('total', { ascending: false }),
      locked ? supabase.from('picks').select('*') : Promise.resolve({ data: [] }),
      supabase.from('results').select('*'),
    ])

    const scores = scoresRes.data || []
    const picks = picksRes.data || []
    const resultsData = resultsRes.data || []

    setRows(scores)
    setAllPicks(picks)

    const resultsMap = {}
    resultsData.forEach(r => { resultsMap[r.matchup_id] = r })
    setResults(resultsMap)

    const me = scores.find(r => r.user_id === user?.id)
    if (me) setMyBreakdown(me)

    // Compute field stats: for each matchup, how many picked each team/games
    if (locked && picks.length) {
      const stats = {}
      ALL_MATCHUPS.forEach(m => {
        const mpicks = picks.filter(p => p.matchup_id === m.id)
        const total = mpicks.length
        const t1 = mpicks.filter(p => p.team === 't1').length
        const t2 = mpicks.filter(p => p.team === 't2').length
        const gamesCounts = { 4: 0, 5: 0, 6: 0, 7: 0 }
        mpicks.forEach(p => { if (p.games) gamesCounts[p.games] = (gamesCounts[p.games] || 0) + 1 })
        stats[m.id] = { total, t1, t2, gamesCounts }
      })
      setFieldStats(stats)
    }

    setLoading(false)
  }

  function getPicksForUser(userId) {
    const obj = {}
    allPicks.filter(p => p.user_id === userId).forEach(p => {
      obj[p.matchup_id] = { team: p.team, games: p.games }
    })
    return obj
  }

  if (loading) return (
    <div className="page-wrap" style={{ textAlign: 'center', paddingTop: 60 }}>
      <span className="spinner" />
    </div>
  )

  return (
    <div className="page-wrap fade-up">
      <div className="section-label">Pool Standings</div>
      {locked && <div style={s.lockedNote}>Picks are locked — click any name to see their full bracket.</div>}

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['#', 'Player', 'R1', 'R2', 'CF', 'Final', 'Total'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isMe = row.user_id === user?.id
              const medal = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#6B8FAD'
              return (
                <tr key={row.user_id}
                  style={{ background: isMe ? 'rgba(200,16,46,0.07)' : 'transparent', cursor: locked ? 'pointer' : 'default' }}
                  onClick={() => locked && setSelectedUser(row)}>
                  <td style={s.td}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: medal }}>{i + 1}</span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 500, color: locked ? '#85B7EB' : 'white', textDecoration: locked ? 'underline' : 'none' }}>
                      {row.display_name || 'Player'}
                    </span>
                    {isMe && <span style={s.youBadge}>YOU</span>}
                  </td>
                  <td style={s.td}><Pts v={row.r1} /></td>
                  <td style={s.td}><Pts v={row.r2} /></td>
                  <td style={s.td}><Pts v={row.r3} /></td>
                  <td style={s.td}><Pts v={row.r4} /></td>
                  <td style={s.td}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: '#FFD700' }}>
                      {row.total}
                    </span>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#6B8FAD', padding: 32 }}>
                No picks yet — check back after picks are submitted!
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pick viewer modal */}
      {selectedUser && locked && (
        <PickViewer
          player={selectedUser}
          picks={getPicksForUser(selectedUser.user_id)}
          results={results}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* vs the field */}
      {locked && Object.keys(fieldStats).length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 28 }}>vs The Field</div>
          <div style={{ fontSize: 13, color: '#6B8FAD', marginBottom: 14 }}>
            How the pool voted on each series.
          </div>
          {ROUNDS.map(round => {
            const completedMatchups = round.matchups.filter(m => fieldStats[m.id] && m.t1 !== 'TBD')
            if (!completedMatchups.length) return null
            return (
              <div key={round.id} style={{ marginBottom: 20 }}>
                <div style={s.roundHeader}>{round.label}</div>
                {completedMatchups.map(m => {
                  const fs = fieldStats[m.id]
                  if (!fs || !fs.total) return null
                  const t1pct = Math.round((fs.t1 / fs.total) * 100)
                  const t2pct = 100 - t1pct
                  const result = results[m.id]
                  return (
                    <div key={m.id} className="card" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B8FAD', marginBottom: 10 }}>
                        <span>{m.a1} vs {m.a2}</span>
                        {result && <span style={{ color: '#1D9E75' }}>{result.winner} won in {result.games}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, minWidth: 36, color: result?.winner === m.a1 ? '#1D9E75' : 'white' }}>{m.a1}</span>
                        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: t1pct + '%', height: '100%', background: result?.winner === m.a1 ? '#1D9E75' : '#C8102E', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 13, color: '#A0B4CC', minWidth: 36, textAlign: 'right' }}>{t1pct}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, minWidth: 36, color: result?.winner === m.a2 ? '#1D9E75' : 'white' }}>{m.a2}</span>
                        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: t2pct + '%', height: '100%', background: result?.winner === m.a2 ? '#1D9E75' : '#378ADD', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 13, color: '#A0B4CC', minWidth: 36, textAlign: 'right' }}>{t2pct}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[4, 5, 6, 7].map(g => {
                          const cnt = fs.gamesCounts[g] || 0
                          const pct = Math.round((cnt / fs.total) * 100)
                          return (
                            <div key={g} style={{ flex: 1, background: result?.games === g ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.04)', border: result?.games === g ? '1px solid #1D9E75' : '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700 }}>{g}</div>
                              <div style={{ fontSize: 11, color: '#6B8FAD' }}>{pct}%</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}

      {myBreakdown && (
        <>
          <div className="section-label" style={{ marginTop: 24 }}>Your Score Breakdown</div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>Your picks</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: '#FFD700' }}>{myBreakdown.total} pts</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'Round 1', val: myBreakdown.r1, max: 80 },
                { label: 'Round 2', val: myBreakdown.r2, max: 80 },
                { label: 'Conf. Finals', val: myBreakdown.r3, max: 60 },
                { label: 'SCF', val: myBreakdown.r4, max: 40 },
              ].map(r => (
                <div key={r.label} style={{ background: '#F8F9FB', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#6B8FAD', marginBottom: 6 }}>{r.label}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: '#041E42' }}>{r.val ?? '—'}</div>
                  <div style={{ fontSize: 10, color: '#9CAAB8', marginTop: 2 }}>/ {r.max} max</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PickViewer({ player, picks, results, onClose }) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: '#041E42' }}>{player.display_name}'s Bracket</div>
            <div style={{ fontSize: 12, color: '#6B8FAD', marginTop: 2 }}>{player.total} pts total</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#A0B4CC', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '0 4px' }}>
          {ROUNDS.map(round => {
            const validMatchups = round.matchups.filter(m => m.t1 !== 'TBD')
            if (!validMatchups.length) return null
            return (
              <div key={round.id} style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600, color: '#6B8FAD', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{round.label}</div>
                {validMatchups.map(m => {
                  const pick = picks[m.id]
                  const result = results[m.id]
                  const pickedAbbr = pick?.team === 't1' ? m.a1 : pick?.team === 't2' ? m.a2 : null
                  const teamCorrect = result && pickedAbbr === result.winner
                  const gamesCorrect = result && pick?.games === result.games
                  const pts = ROUND_POINTS[round.id]
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: 13, color: '#A0B4CC' }}>{m.a1} vs {m.a2}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {pickedAbbr ? (
                          <>
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, color: teamCorrect ? '#1D9E75' : result ? '#FF6B6B' : 'white' }}>
                              {pickedAbbr}
                            </span>
                            {pick?.games && (
                              <span style={{ fontSize: 12, color: gamesCorrect ? '#1D9E75' : result ? '#FF6B6B' : '#A0B4CC' }}>
                                in {pick.games}
                              </span>
                            )}
                            {result && (
                              <span style={{ fontSize: 11, color: (teamCorrect ? pts : 0) + (gamesCorrect ? pts : 0) > 0 ? '#1D9E75' : '#6B8FAD' }}>
                                +{(teamCorrect ? pts : 0) + (gamesCorrect ? pts : 0)} pts
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: '#6B8FAD' }}>No pick</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Pts({ v }) {
  if (v == null || v === 0) return <span style={{ color: '#6B8FAD' }}>—</span>
  return <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700 }}>{v}</span>
}

const s = {
  tableWrap: { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 600,
    letterSpacing: 1.5, textTransform: 'uppercase', color: '#6B8FAD', textAlign: 'left',
    padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)',
  },
  td: { padding: '14px 14px', fontSize: 14, borderBottom: '1px solid rgba(0,0,0,0.05)', verticalAlign: 'middle', color: '#041E42' },
  youBadge: { background: '#C8102E', color: 'white', fontSize: 10, padding: '2px 8px', borderRadius: 10, marginLeft: 8, fontWeight: 700, verticalAlign: 'middle' },
  lockedNote: { fontSize: 13, color: '#1A6BC4', marginBottom: 14, padding: '10px 14px', background: 'rgba(26,107,196,0.06)', border: '1px solid rgba(26,107,196,0.15)', borderRadius: 8 },
  roundHeader: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, color: '#A0B4CC', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(2,15,33,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, padding: 20,
  },
  modal: {
    background: '#051F3E', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, color: '#041E42' },
}
