import { useAuth } from '../hooks/useAuth.jsx'
import { PICKS_DEADLINE } from '../lib/supabase.js'

function getDeadlineLabel() {
  const now = new Date()
  const diff = PICKS_DEADLINE - now
  if (diff <= 0) return 'Picks locked'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `Picks lock in ${d}d ${h % 24}h`
  return `Picks lock in ${h}h`
}

const styles = {
  bar: {
    background: 'linear-gradient(135deg,#020F21 0%,#041E42 60%,#0A1628 100%)',
    padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 58,
    borderBottom: '2px solid #C8102E',
    position: 'sticky', top: 0, zIndex: 200,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  puck: {
    width: 36, height: 36, background: '#C8102E', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, color: 'white',
  },
  logoText: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  logoSub: { fontSize: 10, color: '#A0B4CC', letterSpacing: 2, marginTop: 1 },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  pill: {
    background: 'rgba(200,16,46,0.15)', border: '1px solid rgba(200,16,46,0.4)',
    borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#FFB3C0',
    animation: 'pulse 2s infinite',
  },
  signout: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#A0B4CC', cursor: 'pointer',
  }
}

export default function TopBar() {
  const { user, signOut } = useAuth()
  return (
    <div style={styles.bar}>
      <div style={styles.logo}>
        <div style={styles.puck}>SP</div>
        <div>
          <div style={styles.logoText}>Bahds Playoff Pool</div>
          <div style={styles.logoSub}>2026 PLAYOFFS</div>
        </div>
      </div>
      <div style={styles.right}>
        <div style={styles.pill}>{getDeadlineLabel()}</div>
        {user && (
          <button style={styles.signout} onClick={signOut}>Sign out</button>
        )}
      </div>
    </div>
  )
}
