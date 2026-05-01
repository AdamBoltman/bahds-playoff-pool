import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

export const PICKS_DEADLINE = new Date('2026-05-03T19:00:00Z') // noon PT = 19:00 UTC

export const ROUND_POINTS = { 1: 5, 2: 10, 3: 15, 4: 20 }

// DEFAULT matchups — admin can override teams via Admin > Edit Matchups
// East is confirmed. West Pacific TBD after tonight's games (Apr 16).
export const ROUNDS = [
  {
    id: 1, label: 'Round 1 — First Round',
    confLabel: true,
    matchups: [
      { id: 'e1', conf: 'East', s1: '1', t1: 'Carolina Hurricanes',  a1: 'CAR', s2: 'WC2', t2: 'Ottawa Senators',      a2: 'OTT' },
      { id: 'e2', conf: 'East', s1: '2', t1: 'Tampa Bay Lightning',  a1: 'TBL', s2: '3',   t2: 'Montreal Canadiens',   a2: 'MTL' },
      { id: 'e3', conf: 'East', s1: '1', t1: 'Buffalo Sabres',       a1: 'BUF', s2: 'WC1', t2: 'Boston Bruins',        a2: 'BOS' },
      { id: 'e4', conf: 'East', s1: '2', t1: 'Pittsburgh Penguins',  a1: 'PIT', s2: '3',   t2: 'Philadelphia Flyers',  a2: 'PHI' },
      { id: 'w1', conf: 'West', s1: '1', t1: 'Colorado Avalanche',   a1: 'COL', s2: 'WC2', t2: 'TBD',                  a2: 'TBD' },
      { id: 'w2', conf: 'West', s1: '2', t1: 'Dallas Stars',         a1: 'DAL', s2: '3',   t2: 'Minnesota Wild',       a2: 'MIN' },
      { id: 'w3', conf: 'West', s1: '1', t1: 'Vegas Golden Knights', a1: 'VGK', s2: 'WC1', t2: 'Utah Mammoth',         a2: 'UTA' },
      { id: 'w4', conf: 'West', s1: '2', t1: 'Edmonton Oilers',      a1: 'EDM', s2: '3',   t2: 'TBD',                  a2: 'TBD' },
    ]
  },
  {
    id: 2, label: 'Round 2 — Second Round',
    confLabel: true,
    matchups: [
      { id: 'e5', conf: 'East', s1: '?', t1: 'TBD', a1: '???', s2: '?', t2: 'TBD', a2: '???' },
      { id: 'e6', conf: 'East', s1: '?', t1: 'TBD', a1: '???', s2: '?', t2: 'TBD', a2: '???' },
      { id: 'w5', conf: 'West', s1: '?', t1: 'TBD', a1: '???', s2: '?', t2: 'TBD', a2: '???' },
      { id: 'w6', conf: 'West', s1: '?', t1: 'TBD', a1: '???', s2: '?', t2: 'TBD', a2: '???' },
    ]
  },
  {
    id: 3, label: 'Conference Finals',
    confLabel: false,
    matchups: [
      { id: 'e7', conf: 'East', s1: '?', t1: 'TBD', a1: '???', s2: '?', t2: 'TBD', a2: '???' },
      { id: 'w7', conf: 'West', s1: '?', t1: 'TBD', a1: '???', s2: '?', t2: 'TBD', a2: '???' },
    ]
  },
  {
    id: 4, label: 'Stanley Cup Final',
    confLabel: false,
    matchups: [
      { id: 'f1', conf: 'Final', s1: 'E', t1: 'TBD', a1: '???', s2: 'W', t2: 'TBD', a2: '???' },
    ]
  }
]
