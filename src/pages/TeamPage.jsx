import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchRoster, fetchTeamSchedule, todayStr } from '../lib/nhl.js'
import PlayerCard from '../components/PlayerCard.jsx'

export default function TeamPage() {
  const { abbrev } = useParams()
  const [roster, setRoster] = useState(null)
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPlayerId, setOpenPlayerId] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchRoster(abbrev), fetchTeamSchedule(abbrev)]).then(([r, g]) => {
      setRoster(r)
      setGames(g)
      setLoading(false)
    })
  }, [abbrev])

  const today = todayStr()
  const upcoming = games.filter(g => g.gameDate >= today && g.gameState !== 'FINAL' && g.gameState !== 'OFF').slice(0, 8)
  const teamGame = games.find(g => g.awayTeam?.abbrev === abbrev || g.homeTeam?.abbrev === abbrev)
  const teamSide = teamGame ? (teamGame.awayTeam?.abbrev === abbrev ? teamGame.awayTeam : teamGame.homeTeam) : null
  const teamName = teamSide ? `${teamSide.placeName?.default} ${teamSide.commonName?.default}` : abbrev

  return (
    <div className="page-wrap fade-up">
      <div style={s.header}>
        <img src={`https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`} alt="" style={s.headerLogo} />
        <div style={s.headerName}>{teamName}</div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 14 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 12 }} />)}
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div className="section-label">Upcoming</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }} className="stagger">
                {upcoming.map(g => {
                  const isHome = g.homeTeam?.abbrev === abbrev
                  const opp = isHome ? g.awayTeam : g.homeTeam
                  return (
                    <div key={g.id} className="card" style={s.gameRow}>
                      <span style={s.gameDate}>{new Date(`${g.gameDate}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                      <div style={s.gameOpp}>
                        {opp?.logo && <img src={opp.darkLogo || opp.logo} alt="" style={s.oppLogo} />}
                        <span>{isHome ? 'vs' : '@'} {opp?.commonName?.default}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {roster && (
            <>
              <RosterGroup title="Forwards" players={roster.forwards} onPick={setOpenPlayerId} />
              <RosterGroup title="Defensemen" players={roster.defensemen} onPick={setOpenPlayerId} />
              <RosterGroup title="Goalies" players={roster.goalies} onPick={setOpenPlayerId} />
            </>
          )}
        </>
      )}

      {openPlayerId && <PlayerCard playerId={openPlayerId} onClose={() => setOpenPlayerId(null)} />}
    </div>
  )
}

function RosterGroup({ title, players, onPick }) {
  if (!players?.length) return null
  return (
    <>
      <div className="section-label" style={{ marginTop: 20 }}>{title}</div>
      <div style={s.rosterGrid} className="stagger">
        {players.map(p => (
          <div key={p.id} className="card hover-lift" style={s.playerCard} onClick={() => onPick(p.id)}>
            <img src={p.headshot} alt="" style={s.headshot} onError={e => { e.target.style.visibility = 'hidden' }} />
            <div style={{ minWidth: 0 }}>
              <div style={s.playerName}>{p.firstName?.default} {p.lastName?.default}</div>
              <div style={s.playerSub}>#{p.sweaterNumber} · {p.positionCode}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

const s = {
  header: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 },
  headerLogo: { width: 56, height: 56, objectFit: 'contain' },
  headerName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 700, color: 'var(--text)' },
  gameRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' },
  gameDate: { fontSize: 12, color: 'var(--dim)', width: 60, flexShrink: 0 },
  gameOpp: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text)', fontWeight: 600 },
  oppLogo: { width: 20, height: 20, objectFit: 'contain' },
  rosterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 },
  playerCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' },
  headshot: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface2)', flexShrink: 0 },
  playerName: { fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  playerSub: { fontSize: 11, color: 'var(--dim)' },
}
