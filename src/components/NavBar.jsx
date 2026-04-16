import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const links = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/picks', label: 'My Picks', icon: '✎' },
  { to: '/leaderboard', label: 'Standings', icon: '☆' },
  { to: '/scoring', label: 'Scoring', icon: '◎' },
]

export default function NavBar() {
  const { isAdmin } = useAuth()
  const allLinks = isAdmin ? [...links, { to: '/admin', label: 'Admin', icon: '⚙' }] : links

  return (
    <nav style={s.nav}>
      {allLinks.map(l => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}
          style={({ isActive }) => ({
            ...s.link,
            color: isActive ? 'white' : '#6B8FAD',
            borderBottom: isActive ? '3px solid #C8102E' : '3px solid transparent',
            background: isActive ? 'rgba(200,16,46,0.06)' : 'transparent',
          })}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

const s = {
  nav: {
    background: '#020e1f',
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    overflowX: 'auto', padding: '0 4px',
  },
  link: {
    padding: '13px 18px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 14, fontWeight: 700, letterSpacing: 1.2,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap', textDecoration: 'none',
    transition: 'color 0.15s, background 0.15s',
  },
}
