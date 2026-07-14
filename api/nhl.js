// Vercel serverless function — proxies NHL API calls server-side to bypass CORS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { endpoint } = req.query
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })

  const NHL_STATS = 'https://api.nhle.com/stats/rest/en'
  const NHL_WEB = 'https://api-web.nhle.com/v1'
  const NHL_SEARCH = 'https://search.d3.nhle.com/api/v1'

  // Only allow specific safe endpoints
  const allowed = [
    'skater/summary',
    'goalie/summary',
    'score/now',
    'schedule/',
    'standings/',
    'player/',
    'roster/',
    'club-schedule-season/',
    'search/player',
    'gamecenter/',
  ]

  const isAllowed = allowed.some(a => endpoint.startsWith(a))
  if (!isAllowed) return res.status(403).json({ error: 'Endpoint not allowed' })

  try {
    const isSearchApi = endpoint.startsWith('search/player')
    const isWebApi = endpoint.startsWith('score/') || endpoint.startsWith('schedule/') || endpoint.startsWith('standings/') ||
      endpoint.startsWith('player/') || endpoint.startsWith('roster/') || endpoint.startsWith('club-schedule-season/') || endpoint.startsWith('gamecenter/')
    const base = isSearchApi ? NHL_SEARCH : (isWebApi ? NHL_WEB : NHL_STATS)
    const params = req.query
    delete params.endpoint

    const queryString = new URLSearchParams(params).toString()
    const url = `${base}/${endpoint}${queryString ? '?' + queryString : ''}`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    })

    if (!response.ok) return res.status(response.status).json({ error: 'NHL API error' })

    const data = await response.json()
    res.setHeader('Cache-Control', 's-maxage=300') // cache 5 mins
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
