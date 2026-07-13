// All NHL API calls go through /api/nhl proxy to avoid CORS issues
const PROXY = '/api/nhl'
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

// Update both dates each spring when the bracket is announced (see ROUNDS in lib/supabase.js)
const PLAYOFFS_START = new Date('2026-04-18T00:00:00Z')
const PLAYOFFS_END = new Date('2026-06-30T00:00:00Z')
export const isPlayoffs = () => { const n = new Date(); return n >= PLAYOFFS_START && n <= PLAYOFFS_END }
const seasonId = '20252026'
const gameTypeId = () => isPlayoffs() ? 3 : 2

async function nhlFetch(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString()
  const res = await fetch(`${PROXY}?${qs}`)
  if (!res.ok) throw new Error(`NHL proxy error: ${res.status}`)
  return res.json()
}

export async function fetchSkaterLeaders(limit = 5) {
  try {
    const gt = gameTypeId()
    const cayenne = `gameTypeId=${gt} and seasonId<=${seasonId} and seasonId>=${seasonId}`
    const base = { isAggregate: 'false', isGame: 'false', start: '0', limit: String(limit), factCayenneExp: 'gamesPlayed>=1', cayenneExp: cayenne }

    const [goalsData, pointsData, assistsData] = await Promise.all([
      nhlFetch('skater/summary', { ...base, sort: `[{"property":"goals","direction":"DESC"}]` }),
      nhlFetch('skater/summary', { ...base, sort: `[{"property":"points","direction":"DESC"}]` }),
      nhlFetch('skater/summary', { ...base, sort: `[{"property":"assists","direction":"DESC"}]` }),
    ])

    function parse(data, field) {
      return (data?.data || []).map(p => ({
        lastName: p.skaterFullName?.split(' ').slice(1).join(' ') || p.skaterFullName,
        fullName: p.skaterFullName,
        teamAbbrevs: p.teamAbbrevs,
        playerId: p.playerId,
        value: p[field],
      }))
    }

    return {
      goals:   parse(goalsData, 'goals'),
      points:  parse(pointsData, 'points'),
      assists: parse(assistsData, 'assists'),
      isPlayoffs: isPlayoffs(),
    }
  } catch (e) {
    console.error('fetchSkaterLeaders:', e)
    return { goals: [], points: [], assists: [], isPlayoffs: false }
  }
}

export async function fetchGoalieLeaders(limit = 5) {
  try {
    const gt = gameTypeId()
    const cayenne = `gameTypeId=${gt} and seasonId<=${seasonId} and seasonId>=${seasonId}`
    const data = await nhlFetch('goalie/summary', {
      isAggregate: 'false', isGame: 'false', start: '0', limit: String(limit),
      factCayenneExp: 'gamesPlayed>=10',
      cayenneExp: cayenne,
      sort: `[{"property":"goalsAgainstAverage","direction":"ASC"}]`,
    })
    return (data?.data || []).map(g => ({
      lastName: g.goalieFullName?.split(' ').slice(1).join(' ') || g.goalieFullName,
      fullName: g.goalieFullName,
      teamAbbrevs: g.teamAbbrevs,
      playerId: g.playerId,
      value: g.goalsAgainstAverage,
    }))
  } catch (e) {
    console.error('fetchGoalieLeaders:', e)
    return []
  }
}

// Omitting the `active` param returns both active and retired players in one call
export async function searchPlayers(query, limit = 12) {
  const q = query?.trim()
  if (!q || q.length < 2) return []
  try {
    const data = await nhlFetch('search/player', { culture: 'en-us', limit: String(limit), q })
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error('searchPlayers:', e)
    return []
  }
}

export async function fetchRoster(teamAbbrev) {
  try {
    return await nhlFetch(`roster/${teamAbbrev}/current`)
  } catch (e) {
    console.error('fetchRoster:', e)
    return null
  }
}

export async function fetchTeamSchedule(teamAbbrev) {
  try {
    const data = await nhlFetch(`club-schedule-season/${teamAbbrev}/now`)
    return data.games || []
  } catch (e) {
    console.error('fetchTeamSchedule:', e)
    return []
  }
}

export async function fetchPlayerGameLog(playerId, season, gameType) {
  try {
    const data = await nhlFetch(`player/${playerId}/game-log/${season}/${gameType}`)
    return data.gameLog || []
  } catch (e) {
    console.error('fetchPlayerGameLog:', e)
    return []
  }
}

// Aggregates a player's full NHL career game logs by opponent (goals/assists/points/GP).
// Heavy (one request per NHL season+gameType) — call on demand, not eagerly.
export async function fetchOpponentSplits(playerId, seasonTotals) {
  const nhlSeasons = (seasonTotals || []).filter(s => s.leagueAbbrev === 'NHL')
  const logs = await Promise.all(
    nhlSeasons.map(s => fetchPlayerGameLog(playerId, s.season, s.gameTypeId))
  )
  const byOpponent = {}
  logs.flat().forEach(g => {
    const opp = g.opponentAbbrev
    if (!opp) return
    if (!byOpponent[opp]) byOpponent[opp] = { opponent: opp, gamesPlayed: 0, goals: 0, assists: 0, points: 0 }
    byOpponent[opp].gamesPlayed += 1
    byOpponent[opp].goals += g.goals || 0
    byOpponent[opp].assists += g.assists || 0
    byOpponent[opp].points += g.points || 0
  })
  return Object.values(byOpponent).sort((a, b) => b.points - a.points)
}

export function playerHeadshot(playerId, teamAbbrevs) {
  if (!playerId || !teamAbbrevs) return null
  const team = teamAbbrevs.split(',')[0].trim()
  return `https://assets.nhle.com/mugs/nhl/${seasonId}/${team}/${playerId}.png`
}

export function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// Returns { date, dayAbbrev, numberOfGames, games } for the given day (YYYY-MM-DD, or 'now' for today)
export async function fetchScheduleDay(date = 'now') {
  try {
    const data = await nhlFetch(`schedule/${date}`)
    return data.gameWeek?.[0] || null
  } catch (e) {
    console.error('fetchScheduleDay:', e)
    return null
  }
}

// Off-season only: tells us when the next regular season starts, once the NHL has published it
export async function fetchSeasonInfo() {
  try {
    const data = await nhlFetch('schedule/now')
    return { regularSeasonStartDate: data.regularSeasonStartDate }
  } catch (e) {
    console.error('fetchSeasonInfo:', e)
    return null
  }
}

export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function fetchPlayerLanding(playerId) {
  try {
    return await nhlFetch(`player/${playerId}/landing`)
  } catch (e) {
    console.error('fetchPlayerLanding:', e)
    return null
  }
}

export async function fetchStandings() {
  try {
    const data = await nhlFetch('standings/now')
    return data.standings || []
  } catch (e) {
    console.error('fetchStandings:', e)
    return []
  }
}

// NHL's direct video-id redirect (nhl.com/video/c-{id}) is dead (returns an empty page),
// so link to the game's real gamecenter page instead — it has the recap embedded.
export function gamecenterUrl(game, dateStr) {
  const [y, m, d] = dateStr.split('-')
  const away = game.awayTeam?.abbrev?.toLowerCase()
  const home = game.homeTeam?.abbrev?.toLowerCase()
  return `https://www.nhl.com/gamecenter/${away}-vs-${home}/${y}/${m}/${d}/${game.id}`
}

export async function fetchESPNNews() {
  try {
    const res = await fetch(`${ESPN_BASE}/news?limit=6`)
    const data = await res.json()
    return (data.articles || []).slice(0, 5).map(a => ({
      headline: a.headline,
      published: a.published,
      link: a.links?.web?.href || '#',
      source: 'ESPN'
    }))
  } catch { return [] }
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1) return `${h}h ago`
  return `${m}m ago`
}
