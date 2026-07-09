import { useAuth } from '../hooks/useAuth.jsx'
import { PICKS_DEADLINE } from '../lib/supabase.js'
import { isPlayoffs } from '../lib/nhl.js'

function getDeadlineLabel() {
  const now = new Date()
  const diff = PICKS_DEADLINE - now
  if (diff <= 0) return 'Picks locked'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  const rem = h % 24
  if (d > 0) return `${d}d ${rem}h to lock`
  if (h > 0) return `${h}h to lock`
  return `${Math.floor(diff / 60000)}m to lock`
}

export default function TopBar() {
  const { user, signOut } = useAuth()
  const playoffs = isPlayoffs()
  return (
    <div style={s.bar}>
      <div style={s.logo}>
        <img src="/icon-192.png" alt="Bahds Hockey" style={s.logoImg} />
        <div>
          <div style={s.logoText}>Bahds Hockey</div>
          <div style={s.logoSub}>{playoffs ? '2026 Stanley Cup Playoffs' : 'NHL 2025-26 Season'}</div>
        </div>
      </div>
      <div style={s.right}>
        {playoffs && <div style={s.pill}>⏱ {getDeadlineLabel()}</div>}
        {user && <button style={s.signout} onClick={signOut}>Sign out</button>}
      </div>
    </div>
  )
}

const s = {
  bar: {
    background: '#0a0c12',
    padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 60,
    borderBottom: '1px solid var(--border)',
    boxShadow: '0 0 0 1px rgba(200,16,46,0.15) inset',
    borderTop: '3px solid var(--red)',
    position: 'sticky', top: 0, zIndex: 200,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoImg: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' },
  logoText: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 19, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: 0.3 },
  logoSub: { fontSize: 10, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' },
  right: { display: 'flex', alignItems: 'center', gap: 10 },
  pill: {
    background: 'rgba(200,16,46,0.15)', border: '1px solid rgba(200,16,46,0.4)',
    borderRadius: 20, padding: '5px 12px',
    fontSize: 12, color: '#FFB3C0', fontWeight: 500,
    animation: 'pulse 2.5s infinite',
  },
  signout: {
    background: 'transparent', border: '1px solid var(--border2)',
    borderRadius: 6, padding: '5px 12px',
    fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
  },
}
