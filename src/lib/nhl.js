const NHL_BASE = 'https://api-web.nhle.com/v1'
const NHL_STATS = 'https://api.nhle.com/stats/rest/en'
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

const PLAYOFFS_START = new Date('2026-04-18T00:00:00Z')
const isPlayoffs = () => new Date() >= PLAYOFFS_START
const seasonId = '20252026'
const gameTypeId = () => isPlayoffs() ? 3 : 2

export async function fetchSkaterLeaders() {
  try {
    const gt = gameTypeId()
    // Use the stats REST API — more reliable field names
    const [goalsRes, pointsRes, assistsRes] = await Promise.all([
      fetch(`${NHL_STATS}/skater/summary?limit=1&sort=goals&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gt}`),
      fetch(`${NHL_STATS}/skater/summary?limit=1&sort=points&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gt}`),
      fetch(`${NHL_STATS}/skater/summary?limit=1&sort=assists&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gt}`),
    ])
    const [goalsData, pointsData, assistsData] = await Promise.all([
      goalsRes.json(), pointsRes.json(), assistsRes.json()
    ])

    const g = goalsData?.data?.[0]
    const p = pointsData?.data?.[0]
    const a = assistsData?.data?.[0]

    return {
      goals:   g ? { lastName: g.skaterFullName?.split(' ').pop(), fullName: g.skaterFullName, teamAbbrevs: g.teamAbbrevs, value: g.goals } : null,
      points:  p ? { lastName: p.skaterFullName?.split(' ').pop(), fullName: p.skaterFullName, teamAbbrevs: p.teamAbbrevs, value: p.points } : null,
      assists: a ? { lastName: a.skaterFullName?.split(' ').pop(), fullName: a.skaterFullName, teamAbbrevs: a.teamAbbrevs, value: a.assists } : null,
      isPlayoffs: isPlayoffs(),
    }
  } catch (e) {
    console.error('fetchSkaterLeaders error:', e)
    return { goals: null, points: null, assists: null, isPlayoffs: false }
  }
}

export async function fetchGoalieLeader() {
  try {
    const gt = gameTypeId()
    const res = await fetch(`${NHL_STATS}/goalie/summary?limit=1&sort=goalsAgainstAverage&dir=ASC&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gt}%20and%20gamesPlayed%3E%3D10`)
    const data = await res.json()
    const g = data?.data?.[0]
    if (!g) return null
    return {
      lastName: g.goalieFullName?.split(' ').pop(),
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
