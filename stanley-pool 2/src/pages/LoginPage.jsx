import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await signIn(email.trim().toLowerCase())
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={s.outer}>
      <div style={s.card} className="fade-up">
        <div style={s.logo}>
          <div style={s.puck}>SP</div>
        </div>
        <h1 style={s.title}>Bahds Playoff Pool 2026</h1>
        <p style={s.sub}>Enter your email to get a secure sign-in link. No password needed.</p>

        {!sent ? (
          <form onSubmit={handleSubmit}>
            <input
              style={s.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Sign-In Link'}
            </button>
          </form>
        ) : (
          <div style={s.sentBox}>
            <div style={s.checkmark}>✓</div>
            <div style={s.sentTitle}>Check your email</div>
            <div style={s.sentSub}>
              We sent a sign-in link to <strong style={{ color: 'white' }}>{email}</strong>.
              Click the link in that email to enter the pool.
            </div>
            <button style={{ ...s.btn, marginTop: 16, background: 'transparent', color: '#A0B4CC' }}
              onClick={() => { setSent(false); setEmail('') }}>
              Use a different email
            </button>
          </div>
        )}

        <div style={s.note}>
          Only pool members can sign in. If you haven't been invited, contact the pool admin.
        </div>
      </div>
    </div>
  )
}

const s = {
  outer: {
    minHeight: 'calc(100vh - 58px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#051F3E',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '40px 32px',
    width: '100%', maxWidth: 420,
    textAlign: 'center',
  },
  logo: { marginBottom: 20 },
  puck: {
    width: 56, height: 56, background: '#C8102E', borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700,
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 28, fontWeight: 700, marginBottom: 8,
  },
  sub: { fontSize: 14, color: '#A0B4CC', lineHeight: 1.6, marginBottom: 24 },
  input: {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8, color: 'white', fontSize: 15,
    marginBottom: 12, outline: 'none',
    transition: 'border-color 0.15s',
  },
  btn: {
    width: '100%', padding: '12px',
    background: '#C8102E', color: 'white', border: 'none',
    borderRadius: 8,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  error: {
    color: '#FF8A9A', fontSize: 13, marginBottom: 10, textAlign: 'left',
  },
  sentBox: { textAlign: 'center' },
  checkmark: {
    width: 52, height: 52, background: 'rgba(29,158,117,0.2)',
    border: '1px solid #1D9E75', borderRadius: '50%',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, color: '#1D9E75', marginBottom: 16,
  },
  sentTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 22, fontWeight: 700, marginBottom: 8,
  },
  sentSub: { fontSize: 14, color: '#A0B4CC', lineHeight: 1.6 },
  note: {
    marginTop: 24, fontSize: 12, color: '#6B8FAD', lineHeight: 1.5,
    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20,
  },
}
