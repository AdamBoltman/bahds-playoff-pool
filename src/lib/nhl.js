// NHL unofficial API — no key required
const NHL_BASE = 'https://api-web.nhle.com/v1'
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

export async function fetchNHLStandings() {
  try {
    const res = await fetch(`${NHL_BASE}/standings/now`)
    const data = await res.json()
    return data.standings || []
  } catch { return [] }
}

export async function fetchPlayoffStats() {
  try {
    // Skater leaders
    const [goalsRes, pointsRes] = await Promise.all([
      fetch(`${NHL_BASE}/skater-stats-leaders/20252026/3?categories=goals&limit=5`),
      fetch(`${NHL_BASE}/skater-stats-leaders/20252026/3?categories=points&limit=5`),
    ])
    const goals = await goalsRes.json()
    const points = await pointsRes.json()
    return {
      goals: goals.goals?.slice(0, 3) || [],
      points: points.points?.slice(0, 3) || [],
    }
  } catch { return { goals: [], points: [] } }
}

export async function fetchGoalieStats() {
  try {
    const res = await fetch(`${NHL_BASE}/goalie-stats-leaders/20252026/3?categories=gaa&limit=3`)
    const data = await res.json()
    return data.gaa?.slice(0, 3) || []
  } catch { return [] }
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
