import { ROUND_POINTS } from './supabase.js'

/**
 * results: { [matchupId]: { winner: 'a1'|'a2', games: number } }
 * picks:   { [matchupId]: { team: 't1'|'t2', games: number } }
 * matchups: flat array of all matchup objects from ROUNDS
 */
export function calculateScore(picks, results, matchups) {
  let total = 0
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0 }

  for (const m of matchups) {
    const pick = picks?.[m.id]
    const result = results?.[m.id]
    if (!pick || !result) continue

    const pts = ROUND_POINTS[m.round] || 5

    // Team pick: t1 → a1, t2 → a2
    const pickedAbbr = pick.team === 't1' ? m.a1 : m.a2
    if (pickedAbbr === result.winner) {
      total += pts
      breakdown[m.round] = (breakdown[m.round] || 0) + pts
    }

    // Games pick — independent of team
    if (pickedAbbr === result.winner && pick.games && pick.games === result.games) {
  total += pts
  breakdown[m.round] = (breakdown[m.round] || 0) + pts
}
  }

  return { total, breakdown }
}

export function isDeadlinePassed(deadline) {
  return new Date() > new Date(deadline)
}
