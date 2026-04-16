import { useEffect, useState } from 'react'
import { supabase, ROUNDS } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { calculateScore } from '../lib/scoring.js'
import { useNavigate } from 'react-router-dom'

// Flat matchup list with round info
const ALL_MATCHUPS = ROUNDS.flatMap(r =>
  r.matchups.map(m => ({ ...m, round: r.id }))
)

export default function AdminPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [results, setResults] = useState({})
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(false)
  const [recalcing, setRecalcing] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeTab, setActiveTab] = useState('results')

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    loadResults()
    loadUsers()
  }, [isAdmin])

  async function loadResults() {
    const { data } = await supabase.from('results').select('*')
    if (data) {
      const obj = {}
      data.forEach(r => { obj[r.matchup_id] = { winner: r.winner, games: r.games } })
      setResults(obj)
    }
  }

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('display_name')
    if (data) setUsers(data)
  }

  function setResult(matchupId, field, value) {
    setResults(r => ({ ...r, [matchupId]: { ...r[matchupId], [field]: value } }))
  }

  async function saveResults() {
    setSaving(true)
    const rows = Object.entries(results)
      .filter(([_, v]) => v.winner && v.games)
      .map(([matchup_id, v]) => ({ matchup_id, winner: v.winner, games: Number(v.games) }))
    const { data: existing } = await supabase.from('results').select('matchup_id')
    const existingIds = new Set((existing || []).map(r => r.matchup_id))
    const newlyCompleted = rows.filter(r => !existingIds.has(r.matchup_id))
    await supabase.from('results').upsert(rows, { onConflict: 'matchup_id' })
    for (const result of newlyCompleted) {
      const matchup = ALL_MATCHUPS.find(m => m.id === result.matchup_id)
      if (!matchup) continue
      try {
        await supabase.functions.invoke('notify-series-result', {
          body: { matchupId: result.matchup_id, winner: result.winner, games: result.games, seriesLabel: matchup.a1 + ' vs ' + matchup.a2 }
        })
      } catch (e) { console.warn('Notification skipped:', e) }
    }
    setSaving(false)
    flash('Results saved! Email sent for ' + newlyCompleted.length + ' new result(s).')
  }

  async function recalcScores() {
    setRecalcing(true)
    // Fetch all picks
    const { data: allPicks } = await supabase.from('picks').select('*')
    const { data: allResults } = await supabase.from('results').select('*')
    const { data: allProfiles } = await supabase.from('profiles').select('*')

    if (!allPicks || !allResults) { setRecalcing(false); return }

    const resultsMap = {}
    allResults.forEach(r => { resultsMap[r.matchup_id] = r })

    // Group picks by user
    const byUser = {}
    allPicks.forEach(p => {
      if (!byUser[p.user_id]) byUser[p.user_id] = {}
      byUser[p.user_id][p.matchup_id] = { team: p.team, games: p.games }
    })

    const scoreRows = Object.entries(byUser).map(([user_id, userPicks]) => {
      const profile = allProfiles?.find(p => p.user_id === user_id)
      const { total, breakdown } = calculateScore(userPicks, resultsMap, ALL_MATCHUPS)
      return {
        user_id,
        display_name: profile?.display_name || 'Player',
        r1: breakdown[1] || 0,
        r2: breakdown[2] || 0,
        r3: breakdown[3] || 0,
        r4: breakdown[4] || 0,
        total,
      }
    })

    await supabase.from('scores').upsert(scoreRows, { onConflict: 'user_id' })
    setRecalcing(false)
    flash('Scores recalculated!')
  }

  function flash(text) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  if (!isAdmin) return null

  return (
    <div className="page-wrap fade-up">
      <div style={s.adminBanner}>
        <span style={{ fontSize: 14 }}>&#9881;</span>
        Admin Panel — only visible to you
      </div>

      <div style={s.tabs}>
        {['results', 'users'].map(t => (
          <button key={t} style={{ ...s.tab, ...(activeTab === t ? s.tabActive : {}) }}
            onClick={() => setActiveTab(t)}>
            {t === 'results' ? 'Enter Results' : 'Manage Users'}
          </button>
        ))}
      </div>

      {activeTab === 'results' && (
        <>
          <div className="section-label">Series Results</div>
          <div style={{ fontSize: 13, color: '#6B8FAD', marginBottom: 16 }}>
            Enter the winner (abbreviation) and games played for each completed series. Then hit Save, then Recalculate Scores.
          </div>

          {ROUNDS.map(round => (
            <div key={round.id} style={{ marginBottom: 24 }}>
              <div style={s.roundHeader}>{round.label}</div>
              {round.matchups.map(m => {
                const res = results[m.id] || {}
                return (
                  <div key={m.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px', fontSize: 14 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{m.a1}</span>
                      <span style={{ color: '#6B8FAD', margin: '0 6px' }}>vs</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{m.a2}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={s.inputLabel}>Winner</label>
                      <select style={s.select} value={res.winner || ''}
                        onChange={e => setResult(m.id, 'winner', e.target.value)}>
                        <option value="">—</option>
                        <option value={m.a1}>{m.a1}</option>
                        <option value={m.a2}>{m.a2}</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={s.inputLabel}>Games</label>
                      <select style={s.select} value={res.games || ''}
                        onChange={e => setResult(m.id, 'games', Number(e.target.value))}>
                        <option value="">—</option>
                        {[4, 5, 6, 7].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    {res.winner && res.games && (
                      <span style={{ fontSize: 12, color: '#1D9E75' }}>&#10003; {res.winner} in {res.games}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button style={s.btn} onClick={saveResults} disabled={saving}>
              {saving ? <span className="spinner" /> : '1. Save Results'}
            </button>
            <button style={{ ...s.btn, background: '#0F6E56' }} onClick={recalcScores} disabled={recalcing}>
              {recalcing ? <span className="spinner" /> : '2. Recalculate Scores'}
            </button>
          </div>
          {msg && <div style={s.flashMsg}>{msg}</div>}
        </>
      )}

      {activeTab === 'users' && (
        <>
          <div className="section-label">Pool Members</div>
          <div style={{ fontSize: 13, color: '#6B8FAD', marginBottom: 16 }}>
            Everyone who has signed in. You can update display names here.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <UserRow key={u.user_id} user={u} onSave={loadUsers} />
            ))}
            {users.length === 0 && (
              <div style={{ color: '#6B8FAD', fontSize: 14, padding: 20, textAlign: 'center' }}>
                No members yet — share the app URL and have everyone sign in.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function UserRow({ user, onSave }) {
  const [name, setName] = useState(user.display_name || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('profiles')
      .update({ display_name: name })
      .eq('user_id', user.user_id)
    setSaving(false)
    onSave()
  }

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, fontSize: 13, color: '#A0B4CC', minWidth: 200 }}>{user.email}</div>
      <input style={{ ...s.select, width: 160 }} value={name} onChange={e => setName(e.target.value)} placeholder="Display name" />
      <button style={{ ...s.btn, padding: '6px 14px', fontSize: 13, width: 'auto' }} onClick={save} disabled={saving}>
        {saving ? '...' : 'Save'}
      </button>
    </div>
  )
}

const s = {
  adminBanner: {
    background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)',
    borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#FFD700',
    marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
  },
  tabs: { display: 'flex', gap: 6, marginBottom: 24 },
  tab: {
    padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 500,
    border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
    color: '#A0B4CC', cursor: 'pointer',
  },
  tabActive: { background: '#C8102E', borderColor: '#C8102E', color: 'white' },
  roundHeader: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14, fontWeight: 700, color: '#A0B4CC',
    letterSpacing: 1, textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputLabel: { fontSize: 12, color: '#6B8FAD', whiteSpace: 'nowrap' },
  select: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, color: 'white', fontSize: 13, padding: '6px 10px', outline: 'none',
  },
  btn: {
    padding: '12px 20px', background: '#C8102E', color: 'white', border: 'none',
    borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 15, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  flashMsg: { marginTop: 12, fontSize: 13, color: '#1D9E75' },
}
