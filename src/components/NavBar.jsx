import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const links = [
  { to: '/', label: 'Home' },
  { to: '/picks', label: 'My Picks' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/scoring', label: 'Scoring' },
]

export default function NavBar() {
  const { isAdmin } = useAuth()
  const allLinks = isAdmin ? [...links, { to: '/admin', label: 'Admin' }] : links

  return (
    <nav style={{
      background: '#020F21',
      display: 'flex',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      overflowX: 'auto',
      padding: '0 8px',
    }}>
      {allLinks.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          style={({ isActive }) => ({
            padding: '13px 18px',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 14, fontWeight: 600, letterSpacing: 1,
            textTransform: 'uppercase',
            color: isActive ? 'white' : '#A0B4CC',
            borderBottom: isActive ? '3px solid #C8102E' : '3px solid transparent',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
            transition: 'color 0.15s',
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}
