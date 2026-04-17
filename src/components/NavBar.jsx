import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const links = [
  { to: '/', label: 'Home' },
  { to: '/picks', label: 'My Picks' },
  { to: '/leaderboard', label: 'Standings' },
  { to: '/scoring', label: 'Scoring' },
]

export default function NavBar() {
  const { isAdmin } = useAuth()
  const allLinks = isAdmin ? [...links, { to: '/admin', label: 'Admin' }] : links

  return (
    <nav style={s.nav}>
      {allLinks.map(l => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}
          style={({ isActive }) => ({
            ...s.link,
            color: isActive ? '#C8102E' : '#6B7A8D',
            borderBottom: isActive ? '3px solid #C8102E' : '3px solid transparent',
            fontWeight: isActive ? 700 : 600,
          })}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

const s = {
  nav: {
    background: '#FFFFFF',
    display: 'flex',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    overflowX: 'auto',
    padding: '0 8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  link: {
    padding: '14px 16px',
    fontFamily: "'Barlow Condensed',sans-serif",
    fontSize: 14, letterSpacing: 1.2,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap', textDecoration: 'none',
    transition: 'color 0.15s',
  },
}
