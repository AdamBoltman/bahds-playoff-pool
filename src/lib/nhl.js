// All NHL API calls go through /api/nhl proxy to avoid CORS issues
const PROXY = '/api/nhl'
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

const PLAYOFFS_START = new Date('2026-04-18T00:00:00Z')
export const isPlayoffs = () => new Date() >= PLAYOFFS_START
const seasonId = '20252026'
const gameTypeId = () => isPlayoffs() ? 3 : 2

async function nhlFetch(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString()
  const res = await fetch(`${PROXY}?${qs}`)
  if (!res.ok) throw new Error(`NHL proxy error: ${res.status}`)
  return res.json()
}

export async function fetchSkaterLeaders() {
  try {
    const gt = gameTypeId()
    const cayenne = `gameTypeId=${gt} and seasonId<=${seasonId} and seasonId>=${seasonId}`
    const base = { isAggregate: 'false', isGame: 'false', start: '0', limit: '1', factCayenneExp: 'gamesPlayed>=1', cayenneExp: cayenne }

    const [goalsData, pointsData, assistsData] = await Promise.all([
      nhlFetch('skater/summary', { ...base, sort: `[{"property":"goals","direction":"DESC"}]` }),
      nhlFetch('skater/summary', { ...base, sort: `[{"property":"points","direction":"DESC"}]` }),
      nhlFetch('skater/summary', { ...base, sort: `[{"property":"assists","direction":"DESC"}]` }),
    ])

    function parse(data, field) {
      const p = data?.data?.[0]
      if (!p) return null
      return {
        lastName: p.skaterFullName?.split(' ').slice(1).join(' ') || p.skaterFullName,
        fullName: p.skaterFullName,
        teamAbbrevs: p.teamAbbrevs,
        value: p[field],
      }
    }

    return {
      goals:   parse(goalsData, 'goals'),
      points:  parse(pointsData, 'points'),
      assists: parse(assistsData, 'assists'),
      isPlayoffs: isPlayoffs(),
    }
  } catch (e) {
    console.error('fetchSkaterLeaders:', e)
    return { goals: null, points: null, assists: null, isPlayoffs: false }
  }
}

export async function fetchGoalieLeader() {
  try {
    const gt = gameTypeId()
    const cayenne = `gameTypeId=${gt} and seasonId<=${seasonId} and seasonId>=${seasonId}`
    const data = await nhlFetch('goalie/summary', {
      isAggregate: 'false', isGame: 'false', start: '0', limit: '1',
      factCayenneExp: 'gamesPlayed>=10',
      cayenneExp: cayenne,
      sort: `[{"property":"goalsAgainstAverage","direction":"ASC"}]`,
    })
    const g = data?.data?.[0]
    if (!g) return null
    return {
      lastName: g.goalieFullName?.split(' ').slice(1).join(' ') || g.goalieFullName,
      fullName: g.goalieFullName,
      teamAbbrevs: g.teamAbbrevs,
      value: g.goalsAgainstAverage,
    }
  } catch (e) {
    console.error('fetchGoalieLeader:', e)
    return null
  }
}

export async function fetchNHLScores() {
  try {
    const data = await nhlFetch('score/now')
    return data.games || []
  } catch { return [] }
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
