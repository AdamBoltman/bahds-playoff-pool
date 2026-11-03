import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchStandings } from '../lib/nhl.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

// Given all teams in a conference, return the playoff picture
function getPlayoffPicture(teams) {
  const byDiv = (abbrev) =>
    teams.filter(t => t.divisionAbbrev === abbrev)
         .sort((a, b) => a.divisionSequence - b.divisionSequence)

  // East: Atlantic (A) + Metropolitan (M)
  // West: Central (C) + Pacific (P)
  const divA = byDiv('A'); const divB = byDiv(Object.keys(
    teams.reduce((acc, t) => { acc[t.divisionAbbrev] = true; return acc }, {})
  ).find(k => k !== 'A' && k !== 'C') || 'M')

  // Generic: get the two divisions in this conference
  const divNames = [...new Set(teams.map(t => t.divisionAbbrev))]
  const div1teams = byDiv(divNames[0])
  const div2teams = byDiv(divNames[1])

  // Top 3 from each division are in
  const inViaDivision = new Set([
    ...div1teams.slice(0, 3).map(t => t.teamAbbrev?.default),
    ...div2teams.slice(0, 3).map(t => t.teamAbbrev?.default),
  ])

  // Remaining teams sorted by points for wild card spots
  const remaining = [...teams]
    .filter(t => !inViaDivision.has(t.teamAbbrev?.default))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)

  const wildCards = remaining.slice(0, 2)
  const bubble = remaining.slice(2, 5)
  const eliminated = remaining.slice(5)

  // Determine which division gets top seed (more points for div winner)
  const topDiv = (div1teams[0]?.points || 0) >= (div2teams[0]?.points || 0) ? div1teams : div2teams
  const otherDiv = topDiv === div1teams ? div2teams : div1teams

  const matchups = [
    { seed: '1', a: topDiv[0], aLabel: `${topDiv[0]?.divisionName} 1st`, b: wildCards[1], bLabel: 'WC2' },
    { seed: null, a: topDiv[1], aLabel: `${topDiv[0]?.divisionName} 2nd`, b: topDiv[2], bLabel: `${topDiv[0]?.divisionName} 3rd` },
    { seed: '2', a: otherDiv[0], aLabel: `${otherDiv[0]?.divisionName} 1st`, b: wildCards[0], bLabel: 'WC1' },
    { seed: null, a: otherDiv[1], aLabel: `${otherDiv[0]?.divisionName} 2nd`, b: otherDiv[2], bLabel: `${otherDiv[0]?.divisionName} 3rd` },
  ]

  return { div1: div1teams, div2: div2teams, wildCards, bubble, eliminated, matchups, divNames }
}

function TeamRow({ team, badge, dim, favTeam }) {
  if (!team) return <div style={s.teamRowEmpty}>TBD</div>
  const abbrev = team.teamAbbrev?.default
  const isFav = favTeam === abbrev
  return (
    <Link to={`/team/${abbrev}`} style={{ ...s.teamRow, opacity: dim ? 0.45 : 1, borderColor: isFav ? 'var(--gold)' : undefined }} className="hover-lift">
      <img src={team.teamLogo} alt={abbrev} style={s.teamLogo} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...s.teamName, display: 'flex', alignItems: 'center', gap: 5 }}>
          {team.teamCommonName?.default}
          {isFav && <span style={s.favStar}>★</span>}
        </div>
        <div style={s.teamRecord}>{team.wins}W {team.losses}L {team.otLosses}OT · {team.points} pts</div>
      </div>
      {badge && <span style={{ ...s.badge, background: badgeColor(badge) }}>{badge}</span>}
    </Link>
  )
}

function badgeColor(badge) {
  if (badge === 'WC1' || badge === 'WC2') return 'rgba(45,226,230,0.15)'
  if (badge?.includes('1st')) return 'rgba(255,215,0,0.15)'
  return 'rgba(200,16,46,0.12)'
}

function Matchup({ a, aLabel, b, bLabel }) {
  return (
    <div style={s.matchup}>
      <MatchupTeam team={a} label={aLabel} />
      <div style={s.matchupVs}>vs</div>
      <MatchupTeam team={b} label={bLabel} right />
    </div>
  )
}

function MatchupTeam({ team, label, right }) {
  if (!team) return <div style={{ ...s.matchupTeam, alignItems: right ? 'flex-end' : 'flex-start' }}><div style={s.matchupTBD}>TBD</div></div>
  return (
    <div style={{ ...s.matchupTeam, alignItems: right ? 'flex-end' : 'flex-start' }}>
      <img src={team.teamLogo} alt="" style={s.matchupLogo} />
      <div style={{ ...s.matchupName, textAlign: right ? 'right' : 'left' }}>{team.teamCommonName?.default}</div>
      <div style={{ ...s.matchupLabel, textAlign: right ? 'right' : 'left' }}>{label}</div>
    </div>
  )
}

function ConferencePanel({ label, teams, favTeam }) {
  if (!teams.length) return null
  const { div1, div2, wildCards, bubble, matchups, divNames } = getPlayoffPicture(teams)

  return (
    <div>
      <div style={s.confLabel}>{label}</div>

      {/* Bracket */}
      <div style={s.sectionHead}>If the season ended today</div>
      <div style={s.bracketGrid}>
        {matchups.map((m, i) => (
          <Matchup key={i} a={m.a} aLabel={m.aLabel} b={m.b} bLabel={m.bLabel} />
        ))}
      </div>

      {/* In the playoffs */}
      <div style={s.sectionHead}>In the playoffs</div>
      <div style={s.teamList}>
        {[div1[0], div1[1], div1[2]].map((t, i) => (
          <TeamRow key={t?.teamAbbrev?.default || i} team={t} favTeam={favTeam}
            badge={i === 0 ? `${t?.divisionName} 1st` : i === 1 ? `${t?.divisionName} 2nd` : `${t?.divisionName} 3rd`} />
        ))}
        {[div2[0], div2[1], div2[2]].map((t, i) => (
          <TeamRow key={t?.teamAbbrev?.default || i} team={t} favTeam={favTeam}
            badge={i === 0 ? `${t?.divisionName} 1st` : i === 1 ? `${t?.divisionName} 2nd` : `${t?.divisionName} 3rd`} />
        ))}
        {wildCards.map((t, i) => (
          <TeamRow key={t?.teamAbbrev?.default} team={t} badge={i === 0 ? 'WC1' : 'WC2'} favTeam={favTeam} />
        ))}
      </div>

      {/* Bubble */}
      {bubble.length > 0 && (
        <>
          <div style={s.sectionHead}>On the bubble</div>
          <div style={s.teamList}>
            {bubble.map((t, i) => {
              const ptsBehind = wildCards[1] ? wildCards[1].points - t.points : null
              return (
                <div key={t.teamAbbrev?.default} style={s.bubbleRow}>
                  <TeamRow team={t} dim={false} favTeam={favTeam} />
                  {ptsBehind !== null && (
                    <span style={s.ptsBehind}>{ptsBehind > 0 ? `${ptsBehind} pts back` : 'Even'}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function PlayoffPicturePage() {
  const { user } = useAuth()
  const [standings, setStandings] = useState([])
  const [loading, setLoading] = useState(true)
  const [favTeam, setFavTeam] = useState(null)

  useEffect(() => {
    fetchStandings().then(data => { setStandings(data); setLoading(false) })
    if (user) {
      supabase.from('profiles').select('favourite_team').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.favourite_team) setFavTeam(data.favourite_team) })
    }
  }, [])

  const east = standings.filter(t => t.conferenceAbbrev === 'E')
  const west = standings.filter(t => t.conferenceAbbrev === 'W')

  if (loading) return (
    <div className="page-wrap fade-up">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0,1,2,3,4].map(i => <div key={i} className="card skeleton" style={{ height: 56 }} />)}
      </div>
    </div>
  )

  return (
    <div className="page-wrap fade-up">
      <div style={s.header}>
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>Playoff Picture</div>
          <div style={s.subtitle}>Based on current regular season standings</div>
        </div>
      </div>

      <div style={s.grid}>
        <ConferencePanel label="Eastern Conference" teams={east} favTeam={favTeam} />
        <ConferencePanel label="Western Conference" teams={west} favTeam={favTeam} />
      </div>
    </div>
  )
}

const s = {
  header: { marginBottom: 24 },
  subtitle: { fontSize: 12, color: 'var(--dim)', letterSpacing: 0.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 32 },
  confLabel: {
    fontFamily: "'Barlow Condensed',sans-serif",
    fontSize: 20, fontWeight: 700, color: 'var(--text)',
    letterSpacing: 0.5, marginBottom: 16,
    paddingBottom: 10, borderBottom: '1px solid var(--border)',
  },
  sectionHead: {
    fontSize: 10, fontWeight: 700, color: 'var(--dim)',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 10,
  },
  bracketGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  matchup: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  matchupTeam: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  matchupLogo: { width: 32, height: 32, objectFit: 'contain' },
  matchupName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  matchupLabel: { fontSize: 10, color: 'var(--dim)', letterSpacing: 0.5 },
  matchupTBD: { fontSize: 14, color: 'var(--dim)', fontStyle: 'italic' },
  matchupVs: { fontSize: 11, color: 'var(--dim)', fontWeight: 700, flexShrink: 0 },
  teamList: { display: 'flex', flexDirection: 'column', gap: 6 },
  teamRow: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 12,
    textDecoration: 'none', color: 'inherit',
  },
  teamRowEmpty: { padding: '10px 14px', color: 'var(--dim)', fontSize: 13, fontStyle: 'italic' },
  teamLogo: { width: 28, height: 28, objectFit: 'contain', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  teamRecord: { fontSize: 11, color: 'var(--dim)', marginTop: 1 },
  badge: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
    padding: '3px 8px', borderRadius: 20,
    color: 'var(--muted)', flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  favStar: { fontSize: 11, color: 'var(--gold)', lineHeight: 1 },
  bubbleRow: { position: 'relative' },
  ptsBehind: {
    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
    fontSize: 11, color: 'var(--red)', fontWeight: 600,
  },
}
