import { createClient } from '@supabase/supabase-js'

const NHL_WEB = 'https://api-web.nhle.com/v1'

// Update this each April when the bracket is seeded:
// - Go to nhl.com/playoffs once the bracket drops
// - Match each series letter (A-H) to our internal matchup IDs below
// - Series letters A-D = East, E-H = West, in seed order
//   (top division winner vs WC2 first, then its division 2nd vs 3rd, then other div, then other div 2nd vs 3rd)
const SERIES_MAP = {
  // Round 1 — set each April
  A: 'e1', B: 'e4', C: 'e3', D: 'e2',  // East: A = top East seed vs WC2
  E: 'w1', F: 'w2', G: 'w3', H: 'w4',  // West: E = top West seed vs WC2
  // Round 2
  I: 'e6', J: 'e5', K: 'w5', L: 'w6',
  // Conference Finals
  M: 'e7', N: 'w7',
  // Stanley Cup Final
  O: 'f1',
}

// Round numbers per matchup — must stay in sync with ROUNDS in src/lib/supabase.js
const MATCHUP_ROUND = {
  e1: 1, e2: 1, e3: 1, e4: 1, w1: 1, w2: 1, w3: 1, w4: 1,
  e5: 2, e6: 2, w5: 2, w6: 2,
  e7: 3, w7: 3,
  f1: 4,
}

const ROUND_POINTS = { 1: 5, 2: 10, 3: 15, 4: 20 }

// Replicate scoring.js logic for server-side recalculation
function recalcAll(allPicks, allResults, allProfiles, overridesMap) {
  const resultsMap = {}
  allResults.forEach(r => { resultsMap[r.matchup_id] = r })

  const byUser = {}
  allPicks.forEach(p => {
    if (!byUser[p.user_id]) byUser[p.user_id] = {}
    byUser[p.user_id][p.matchup_id] = { team: p.team, games: p.games }
  })

  return Object.entries(byUser).map(([user_id, userPicks]) => {
    const profile = allProfiles.find(p => p.user_id === user_id)
    let total = 0
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0 }

    for (const [matchupId, pick] of Object.entries(userPicks)) {
      const result = resultsMap[matchupId]
      if (!result?.winner) continue
      const ov = overridesMap[matchupId]
      if (!ov) continue
      const pickedAbbr = pick.team === 't1' ? ov.a1 : ov.a2
      const round = MATCHUP_ROUND[matchupId] || 1
      const pts = ROUND_POINTS[round] || 5
      if (pickedAbbr === result.winner) {
        total += pts
        breakdown[round] = (breakdown[round] || 0) + pts
        if (pick.games && pick.games === result.games) {
          total += pts
          breakdown[round] = (breakdown[round] || 0) + pts
        }
      }
    }

    return {
      user_id,
      display_name: profile?.display_name || 'Player',
      r1: breakdown[1] || 0,
      r2: breakdown[2] || 0,
      r3: breakdown[3] || 0,
      r4: breakdown[4] || 0,
      total,
    }
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: 'Missing env vars. Add SUPABASE_SERVICE_ROLE_KEY to Vercel and re-deploy.',
    })
  }

  // Use service role key to bypass RLS for server-side writes
  const supabase = createClient(supabaseUrl, serviceKey)
  const log = []

  try {
    // Fetch NHL playoff bracket
    const bracketRes = await fetch(`${NHL_WEB}/playoff-bracket/now`, {
      headers: { 'User-Agent': 'BahdsHockey/1.0', Accept: 'application/json' },
    })

    if (!bracketRes.ok) {
      return res.status(200).json({ message: `NHL returned ${bracketRes.status} — playoffs not started yet`, log })
    }

    const bracket = await bracketRes.json()
    const rounds = bracket.rounds || []

    if (!rounds.length) {
      return res.status(200).json({ message: 'No bracket data yet — playoffs have not started', log })
    }

    const overrideRows = []
    const seriesScoreRows = []
    const resultRows = []

    for (const round of rounds) {
      for (const series of (round.series || [])) {
        const letter = series.seriesLetter
        const matchupId = SERIES_MAP[letter]
        if (!matchupId) {
          log.push(`No mapping for series letter "${letter}" — update SERIES_MAP in api/sync-bracket.js`)
          continue
        }

        const top = series.topSeedTeam
        const bot = series.bottomSeedTeam
        if (!top?.abbrev || !bot?.abbrev) continue

        // Always upsert team identities so overrides are current
        overrideRows.push({
          matchup_id: matchupId,
          t1: top.name?.default || top.abbrev,
          a1: top.abbrev,
          t2: bot.name?.default || bot.abbrev,
          a2: bot.abbrev,
        })

        // Live series win counts (even during an ongoing series)
        seriesScoreRows.push({
          matchup_id: matchupId,
          score1: series.topSeedWins || 0,
          score2: series.bottomSeedWins || 0,
        })

        // Completed series → write result
        const status = series.seriesStatus || ''
        if (status === 'TopSeedWins' || status === 'BottomSeedWins' || status === 'seriesOver') {
          const topW = series.topSeedWins || 0
          const botW = series.bottomSeedWins || 0
          const winner = topW >= botW ? top.abbrev : bot.abbrev
          const totalGames = topW + botW
          resultRows.push({ matchup_id: matchupId, winner, games: totalGames })
          log.push(`✓ ${letter}→${matchupId}: ${winner} in ${totalGames}`)
        }
      }
    }

    // Write to DB
    if (overrideRows.length) {
      const { error } = await supabase.from('matchup_overrides').upsert(overrideRows, { onConflict: 'matchup_id' })
      if (error) log.push(`overrides error: ${error.message}`)
    }

    if (seriesScoreRows.length) {
      const { error } = await supabase.from('series_scores').upsert(seriesScoreRows, { onConflict: 'matchup_id' })
      if (error) log.push(`series_scores error: ${error.message}`)
    }

    if (resultRows.length) {
      const { error } = await supabase.from('results').upsert(resultRows, { onConflict: 'matchup_id' })
      if (error) log.push(`results error: ${error.message}`)
    }

    // Recalculate pool scores after any result changes
    let recalcMsg = 'No completed series — scores unchanged'
    if (resultRows.length) {
      const [picksRes, resultsRes, profilesRes, ovRes] = await Promise.all([
        supabase.from('picks').select('*'),
        supabase.from('results').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('matchup_overrides').select('*'),
      ])

      const overridesMap = {}
      ;(ovRes.data || []).forEach(o => { overridesMap[o.matchup_id] = o })

      const scoreRows = recalcAll(
        picksRes.data || [],
        resultsRes.data || [],
        profilesRes.data || [],
        overridesMap
      )

      if (scoreRows.length) {
        const { error } = await supabase.from('scores').upsert(scoreRows, { onConflict: 'user_id' })
        if (error) log.push(`scores error: ${error.message}`)
        else recalcMsg = `Recalculated scores for ${scoreRows.length} players`
      }
    }

    return res.status(200).json({
      ok: true,
      series: overrideRows.length,
      results: resultRows.length,
      recalc: recalcMsg,
      log,
    })
  } catch (err) {
    console.error('sync-bracket error:', err)
    return res.status(500).json({ error: err.message, log })
  }
}
