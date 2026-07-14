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

// Fallback link — NHL's direct video-id redirect (nhl.com/video/c-{id}) is dead,
// but the full gamecenter page works and has the recap embedded there too.
export function gamecenterUrl(game, dateStr) {
  const [y, m, d] = dateStr.split('-')
  const away = game.awayTeam?.abbrev?.toLowerCase()
  const home = game.homeTeam?.abbrev?.toLowerCase()
  return `https://www.nhl.com/gamecenter/${away}-vs-${home}/${y}/${m}/${d}/${game.id}`
}

// Returns the numeric Brightcove video IDs for a game's recap/condensed-game videos, or null
export async function fetchGameVideoIds(gameId) {
  try {
    const data = await nhlFetch(`gamecenter/${gameId}/right-rail`)
    const v = data?.gameVideo
    if (!v) return null
    return { recap: v.threeMinRecap || null, condensed: v.condensedGame || null }
  } catch (e) {
    console.error('fetchGameVideoIds:', e)
    return null
  }
}

// NHL's own video pages embed this exact Brightcove player (account 6415718365001) —
// confirmed by inspecting their page source. No API key needed, embeddable in an iframe.
const BRIGHTCOVE_ACCOUNT = '6415718365001'
const BRIGHTCOVE_PLAYER = 'D3UCGynRWU_default'
export function brightcoveEmbedUrl(videoId) {
  return `https://players.brightcove.net/${BRIGHTCOVE_ACCOUNT}/${BRIGHTCOVE_PLAYER}/index.html?videoId=${videoId}&autoplay=true`
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

// ESPN's team IDs don't match NHL's official abbreviations for a handful of teams
// (e.g. SJS->SJ, TBL->TB, UTA->129764) — mapped here by NHL abbrev since that's what the rest of the app uses.
const ESPN_TEAM_IDS = {
  ANA: 25, BOS: 1, BUF: 2, CAR: 7, CBJ: 29, CGY: 3, CHI: 4, COL: 17, DAL: 9, DET: 5,
  EDM: 6, FLA: 26, LAK: 8, MIN: 30, MTL: 10, NJD: 11, NSH: 27, NYI: 12, NYR: 13, OTT: 14,
  PHI: 15, PIT: 16, SEA: 124292, SJS: 18, STL: 19, TBL: 20, TOR: 21, UTA: 129764,
  VAN: 22, VGK: 37, WPG: 28, WSH: 23,
}

// Official team X/Twitter handles, for the embedded timeline on TeamPage
const TEAM_X_HANDLES = {
  ANA: 'AnaheimDucks', BOS: 'NHLBruins', BUF: 'BuffaloSabres', CAR: 'Canes', CBJ: 'BlueJacketsNHL',
  CGY: 'NHLFlames', CHI: 'NHLBlackhawks', COL: 'Avalanche', DAL: 'DallasStars', DET: 'DetroitRedWings',
  EDM: 'EdmontonOilers', FLA: 'FlaPanthers', LAK: 'LAKings', MIN: 'mnwild', MTL: 'CanadiensMTL',
  NJD: 'NJDevils', NSH: 'PredsNHL', NYI: 'NYIslanders', NYR: 'NYRangers', OTT: 'Senators',
  PHI: 'NHLFlyers', PIT: 'penguins', SEA: 'SeattleKraken', SJS: 'SanJoseSharks', STL: 'StLouisBlues',
  TBL: 'TBLightning', TOR: 'MapleLeafs', UTA: 'UtahMammoth', VAN: 'Canucks', VGK: 'GoldenKnights',
  WPG: 'NHLJets', WSH: 'Capitals',
}

export function getTeamXHandle(teamAbbrev) {
  return TEAM_X_HANDLES[teamAbbrev] || null
}

export async function fetchTeamNews(teamAbbrev, limit = 5) {
  const espnId = ESPN_TEAM_IDS[teamAbbrev]
  if (!espnId) return []
  try {
    const res = await fetch(`${ESPN_BASE}/news?team=${espnId}&limit=${limit}`)
    const data = await res.json()
    return (data.articles || []).slice(0, limit).map(a => ({
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
