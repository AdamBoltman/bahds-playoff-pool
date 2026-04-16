// NHL unofficial API — no key required
const NHL_BASE = 'https://api-web.nhle.com/v1'
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

// Playoffs start April 18 2026
const PLAYOFFS_START = new Date('2026-04-18T00:00:00Z')
const isPlayoffs = () => new Date() >= PLAYOFFS_START
const seasonType = () => isPlayoffs() ? 3 : 2 // 2 = regular season, 3 = playoffs
const seasonId = '20252026'

export async function fetchSkaterLeaders() {
  try {
    const type = seasonType()
    const [goalsRes, pointsRes, assistsRes] = await Promise.all([
      fetch(`${NHL_BASE}/skater-stats-leaders/${seasonId}/${type}?categories=goals&limit=1`),
      fetch(`${NHL_BASE}/skater-stats-leaders/${seasonId}/${type}?categories=points&limit=1`),
      fetch(`${NHL_BASE}/skater-stats-leaders/${seasonId}/${type}?categories=assists&limit=1`),
    ])
    const [goals, points, assists] = await Promise.all([
      goalsRes.json(), pointsRes.json(), assistsRes.json()
    ])
    return {
      goals:   goals.goals?.[0]   || null,
      points:  points.points?.[0] || null,
      assists: assists.assists?.[0] || null,
      isPlayoffs: isPlayoffs(),
    }
  } catch { return { goals: null, points: null, assists: null, isPlayoffs: false } }
}

export async function fetchGoalieLeader() {
  try {
    const type = seasonType()
    const res = await fetch(`${NHL_BASE}/goalie-stats-leaders/${seasonId}/${type}?categories=gaa&limit=1`)
    const data = await res.json()
    return data.gaa?.[0] || null
  } catch { return null }
}

export async function fetchESPNNews() {
  try {
    const res = await fetch(`${ESPN_BASE}/news?limit=6`)
    const data = await res.json()
    return (data.articles || []).slice(0, 5).map(a => ({
      headline: a.headline,
      description: a.description,
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
