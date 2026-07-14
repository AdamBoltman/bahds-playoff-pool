// Vercel serverless function — fetches RSS feeds server-side to bypass CORS
// (Sportsnet/CBS Sports don't set CORS headers, and it's XML anyway).

const RSS_SOURCES = {
  sportsnet: { url: 'https://www.sportsnet.ca/hockey/nhl/feed/', name: 'Sportsnet' },
  cbs: { url: 'https://www.cbssports.com/rss/headlines/nhl/', name: 'CBS Sports' },
}

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  if (!m) return null
  let val = m[1].trim()
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
  if (cdata) val = cdata[1].trim()
  return decodeEntities(val)
}

function stripHtml(str) {
  return str ? str.replace(/<[^>]+>/g, '').trim() : ''
}

function parseRSS(xml, sourceName) {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/g) || []
  return items.map(item => {
    const headline = extractTag(item, 'title')
    const link = extractTag(item, 'link')
    const description = stripHtml(extractTag(item, 'description'))
    const pubDate = extractTag(item, 'pubDate')
    const imgMatch = item.match(/<enclosure[^>]*url="([^"]+)"/)
    return {
      headline, link: link?.trim(),
      description,
      published: pubDate ? new Date(pubDate).toISOString() : null,
      image: imgMatch ? imgMatch[1] : null,
      source: sourceName,
    }
  }).filter(a => a.headline && a.link && a.description)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { source } = req.query
  if (!source) return res.status(400).json({ error: 'Missing source' })

  try {
    const rssSource = RSS_SOURCES[source]
    if (!rssSource) return res.status(403).json({ error: 'Unknown source' })

    const response = await fetch(rssSource.url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml' }
    })
    if (!response.ok) return res.status(response.status).json({ error: 'RSS fetch error' })
    const xml = await response.text()
    const articles = parseRSS(xml, rssSource.name).slice(0, 8)
    res.setHeader('Cache-Control', 's-maxage=600')
    return res.status(200).json({ articles })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
