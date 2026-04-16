import { useAuth } from '../hooks/useAuth.jsx'
import { PICKS_DEADLINE } from '../lib/supabase.js'

function getDeadlineLabel() {
  const now = new Date()
  const diff = PICKS_DEADLINE - now
  if (diff <= 0) return '🔒 Picks locked'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  const rem = h % 24
  if (d > 0) return `⏱ ${d}d ${rem}h to lock`
  if (h > 0) return `⏱ ${h}h to lock`
  const m = Math.floor(diff / 60000)
  return `⏱ ${m}m to lock`
}

export default function TopBar() {
  const { user, signOut } = useAuth()

  return (
    <div style={s.bar}>
      <div style={s.logo}>
        <img src="/icon-192.png" alt="Bahds Pool" style={s.logoImg} />
        <div>
          <div style={s.logoText}>Bahds Playoff Pool</div>
          <div style={s.logoSub}>2026 Stanley Cup Playoffs</div>
        </div>
      </div>
      <div style={s.right}>
        <div style={s.pill}>{getDeadlineLabel()}</div>
        {user && (
          <button style={s.signout} onClick={signOut}>Sign out</button>
        )}
      </div>
    </div>
  )
}

const s = {
  bar: {
    background: '#020e1f',
    padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 60,
    borderBottom: '2px solid #C8102E',
    position: 'sticky', top: 0, zIndex: 200,
    boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoImg: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' },
  logoText: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 19, fontWeight: 700, letterSpacing: 0.5, color: 'white', lineHeight: 1.2,
  },
  logoSub: { fontSize: 10, color: '#6B8FAD', letterSpacing: 1.5, textTransform: 'uppercase' },
  right: { display: 'flex', alignItems: 'center', gap: 10 },
  pill: {
    background: 'rgba(200,16,46,0.12)',
    border: '1px solid rgba(200,16,46,0.35)',
    borderRadius: 20, padding: '5px 12px',
    fontSize: 12, color: '#FFB3C0', fontWeight: 500,
    animation: 'pulse 2.5s infinite',
  },
  signout: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, padding: '5px 12px',
    fontSize: 12, color: '#6B8FAD', cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  },
}
