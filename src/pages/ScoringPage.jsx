export default function ScoringPage() {
  const rounds = [
    { label: 'Round 1 — First Round', pts: 5, max: 80, matchups: 8 },
    { label: 'Round 2 — Second Round', pts: 10, max: 80, matchups: 4 },
    { label: 'Conference Finals', pts: 15, max: 60, matchups: 2 },
    { label: 'Stanley Cup Final', pts: 20, max: 40, matchups: 1 },
  ]

  const rules = [
    { label: 'Correct winner', sub: 'Pick the right team to advance', icon: '🏒' },
    { label: 'Correct series length', sub: 'Right number of games — regardless of which team wins', icon: '📅' },
  ]

  return (
    <div className="page-wrap fade-up">
      <div className="section-label">How scoring works</div>

      <div style={s.intro}>
        Every series has two independent picks: <strong style={{ color: 'white' }}>who wins</strong> and{' '}
        <strong style={{ color: 'white' }}>how many games</strong>. Each earns points separately — you can
        get games points even if you picked the wrong winner.
      </div>

      {rounds.map(r => (
        <div key={r.label} className="card" style={{ marginBottom: 10 }}>
          <div style={s.roundRow}>
            <div>
              <div style={s.roundLabel}>{r.label}</div>
              <div style={s.roundSub}>{r.matchups} series · {r.matchups * 2} picks available</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={s.ptsVal}>+{r.pts} pts</div>
              <div style={s.ptsMax}>{r.max} pts max</div>
            </div>
          </div>
          <div style={s.rulesRow}>
            {rules.map(rule => (
              <div key={rule.label} style={s.ruleChip}>
                <div style={s.ruleLabel}>{rule.label}</div>
                <div style={s.ruleSub}>{rule.sub}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={s.totalRow}>
          <span style={s.totalLabel}>Maximum possible score</span>
          <span style={s.totalVal}>260 pts</span>
        </div>
        <div style={s.totalBreak}>
          80 + 80 + 60 + 40 across all four rounds
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 24 }}>Example</div>
      <div className="card">
        <div style={s.exampleTitle}>You pick: Colorado in 6 games</div>
        <div style={s.exampleRows}>
          <div style={s.exRow}>
            <span style={{ color: '#A0B4CC' }}>Colorado wins in 5 games</span>
            <span style={{ color: '#1D9E75' }}>+5 pts (right team)</span>
          </div>
          <div style={s.exRow}>
            <span style={{ color: '#A0B4CC' }}>Colorado wins in 6 games</span>
            <span style={{ color: '#1D9E75' }}>+10 pts (team + games)</span>
          </div>
          <div style={s.exRow}>
            <span style={{ color: '#A0B4CC' }}>LA Kings win in 6 games</span>
            <span style={{ color: '#1D9E75' }}>+5 pts (right games, wrong team)</span>
          </div>
          <div style={s.exRow}>
            <span style={{ color: '#A0B4CC' }}>LA Kings win in 7 games</span>
            <span style={{ color: '#6B8FAD' }}>0 pts</span>
          </div>
        </div>
      </div>

      <div className="section-label" style={{ marginTop: 24 }}>Rules</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          'Picks lock Sunday April 20 at noon PT and cannot be changed after.',
          'Later rounds unlock progressively as results from previous rounds are entered.',
          'Scoring is automatic — your points update as series results come in.',
          'The leaderboard is visible to all pool members at all times.',
          'This pool is free, private, and just for fun. No money, no ads.',
        ].map((rule, i) => (
          <div key={i} style={s.ruleItem}>
            <div style={s.ruleDot} />
            <span style={{ fontSize: 14, color: '#A0B4CC', lineHeight: 1.5 }}>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  intro: {
    background: '#051F3E', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '14px 16px',
    fontSize: 14, color: '#A0B4CC', lineHeight: 1.6, marginBottom: 16,
  },
  roundRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  roundLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700 },
  roundSub: { fontSize: 12, color: '#6B8FAD', marginTop: 3 },
  ptsVal: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700, color: '#FFD700' },
  ptsMax: { fontSize: 11, color: '#6B8FAD', marginTop: 2 },
  rulesRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  ruleChip: {
    background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px',
  },
  ruleLabel: { fontSize: 13, fontWeight: 500, color: 'white', marginBottom: 3 },
  ruleSub: { fontSize: 11, color: '#6B8FAD', lineHeight: 1.4 },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 },
  totalVal: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 700, color: '#FFD700' },
  totalBreak: { fontSize: 13, color: '#6B8FAD', marginTop: 6 },
  exampleTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 12 },
  exampleRows: { display: 'flex', flexDirection: 'column', gap: 8 },
  exRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  ruleItem: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  ruleDot: { width: 6, height: 6, background: '#C8102E', borderRadius: '50%', marginTop: 7, flexShrink: 0 },
}
