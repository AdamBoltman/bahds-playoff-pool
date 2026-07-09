import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { isPlayoffs } from '../lib/nhl.js'

const baseLinks = [
  { to: '/', label: 'Home' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/leaderboard', label: 'Pool' },
]

const playoffLinks = [
  { to: '/picks', label: 'My Picks' },
  { to: '/scoring', label: 'Scoring' },
]

export default function NavBar() {
  const { isAdmin } = useAuth()
  let allLinks = isPlayoffs() ? [...baseLinks, ...playoffLinks] : baseLinks
  if (isAdmin) allLinks = [...allLinks, { to: '/admin', label: 'Admin' }]

  return (
    <nav style={s.nav}>
      {allLinks.map(l => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'}
          style={({ isActive }) => ({
            ...s.link,
            color: isActive ? 'var(--red)' : 'var(--muted)',
            borderBottom: isActive ? '3px solid var(--red)' : '3px solid transparent',
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
    background: 'var(--surface)',
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto',
    padding: '0 8px',
    position: 'sticky', top: 60, zIndex: 190,
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
