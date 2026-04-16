const NHL_STATS = 'https://api.nhle.com/stats/rest/en'
const NHL_BASE = 'https://api-web.nhle.com/v1'
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

const PLAYOFFS_START = new Date('2026-04-18T00:00:00Z')
export const isPlayoffs = () => new Date() >= PLAYOFFS_START
const seasonId = '20252026'
const gameTypeId = () => isPlayoffs() ? 3 : 2

// Build correct NHL stats API URL with proper sort format
function skaterUrl(sortProp) {
  const gt = gameTypeId()
  const sort = encodeURIComponent(`[{"property":"${sortProp}","direction":"DESC"},{"property":"playerId","direction":"ASC"}]`)
  return `${NHL_STATS}/skater/summary?isAggregate=false&isGame=false&sort=${sort}&start=0&limit=1&factCayenneExp=gamesPlayed%3E%3D1&cayenneExp=gameTypeId%3D${gt}%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`
}

function goalieUrl() {
  const gt = gameTypeId()
  const sort = encodeURIComponent(`[{"property":"goalsAgainstAverage","direction":"ASC"},{"property":"playerId","direction":"ASC"}]`)
  return `${NHL_STATS}/goalie/summary?isAggregate=false&isGame=false&sort=${sort}&start=0&limit=1&factCayenneExp=gamesPlayed%3E%3D10&cayenneExp=gameTypeId%3D${gt}%20and%20seasonId%3C%3D${seasonId}%20and%20seasonId%3E%3D${seasonId}`
}

export async function fetchSkaterLeaders() {
  try {
    const [goalsRes, pointsRes, assistsRes] = await Promise.all([
      fetch(skaterUrl('goals')),
      fetch(skaterUrl('points')),
      fetch(skaterUrl('assists')),
    ])
    const [goalsData, pointsData, assistsData] = await Promise.all([
      goalsRes.json(), pointsRes.json(), assistsRes.json()
    ])

    function parse(data, statField) {
      const p = data?.data?.[0]
      if (!p) return null
      return {
        lastName: p.skaterFullName?.split(' ').slice(1).join(' ') || p.skaterFullName,
        fullName: p.skaterFullName,
        teamAbbrevs: p.teamAbbrevs,
        value: p[statField],
      }
    }

    return {
      goals:   parse(goalsData, 'goals'),
      points:  parse(pointsData, 'points'),
      assists: parse(assistsData, 'assists'),
      isPlayoffs: isPlayoffs(),
    }
  } catch (e) {
    console.error('fetchSkaterLeaders error:', e)
    return { goals: null, points: null, assists: null, isPlayoffs: false }
  }
}

export async function fetchGoalieLeader() {
  try {
    const res = await fetch(goalieUrl())
    const data = await res.json()
    const g = data?.data?.[0]
    if (!g) return null
    return {
      lastName: g.goalieFullName?.split(' ').slice(1).join(' ') || g.goalieFullName,
      fullName: g.goalieFullName,
      teamAbbrevs: g.teamAbbrevs,
      value: g.goalsAgainstAverage,
    }
  } catch (e) {
    console.error('fetchGoalieLeader error:', e)
    return null
  }
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

export async function fetchNHLScores() {
  try {
    const res = await fetch(`${NHL_BASE}/score/now`)
    const data = await res.json()
    return data.games || []
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
