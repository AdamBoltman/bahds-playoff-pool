import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { supabase } from '../lib/supabase.js'

// Detect if we're on a password reset callback
function isResetMode() {
  const hash = window.location.hash
  return hash.includes('type=recovery') || hash.includes('access_token')
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [mode, setMode] = useState(isResetMode() ? 'reset' : 'login') // login | signup | forgot | reset | sent
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setLoading(false)
    if (error) setError('Incorrect email or password. Try again or use Forgot Password.')
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!email || !password) return
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords don\'t match.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: window.location.origin }
    })
    setLoading(false)
    if (error) setError(error.message)
    else { setMode('sent'); setMessage(`Account created! Check your email to verify, then come back and log in.`) }
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/login`
    })
    setLoading(false)
    if (error) setError(error.message)
    else { setMode('sent'); setMessage(`Password reset link sent to ${email}. Check your inbox.`) }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!password) return
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords don\'t match.'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message)
    else { setMode('sent'); setMessage('Password updated! You can now log in with your new password.') }
  }

  const titles = {
    login: 'Welcome back',
    signup: 'Create account',
    forgot: 'Reset password',
    reset: 'Set new password',
    sent: 'Check your email',
  }

  const subtitles = {
    login: 'Sign in to your pool account',
    signup: 'Join the Bahds Playoff Pool',
    forgot: 'We\'ll send you a reset link',
    reset: 'Choose a new password',
    sent: message,
  }

  return (
    <div style={s.outer}>
      <div style={s.card} className="fade-up">
        <div style={s.logoWrap}>
          <img src="/icon-192.png" alt="Bahds Pool" style={s.puck} />
        </div>
        <div style={s.appName}>Bahds Playoff Pool</div>
        <div style={s.title}>{titles[mode]}</div>
        <div style={s.subtitle}>{subtitles[mode]}</div>

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <input style={s.input} type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
            <input style={s.input} type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required />
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            <div style={s.links}>
              <button type="button" style={s.link} onClick={() => { setMode('forgot'); setError('') }}>
                Forgot password?
              </button>
              <button type="button" style={s.link} onClick={() => { setMode('signup'); setError('') }}>
                New here? Create account
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <input style={s.input} type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
            <input style={s.input} type="password" placeholder="Password (min 6 characters)" value={password}
              onChange={e => setPassword(e.target.value)} required />
            <input style={s.input} type="password" placeholder="Confirm password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required />
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
            <div style={s.links}>
              <button type="button" style={s.link} onClick={() => { setMode('login'); setError('') }}>
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot}>
            <input style={s.input} type="email" placeholder="Your email address" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Reset Link'}
            </button>
            <div style={s.links}>
              <button type="button" style={s.link} onClick={() => { setMode('login'); setError('') }}>
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            <input style={s.input} type="password" placeholder="New password (min 6 characters)" value={password}
              onChange={e => setPassword(e.target.value)} required autoFocus />
            <input style={s.input} type="password" placeholder="Confirm new password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required />
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Update Password'}
            </button>
          </form>
        )}

        {mode === 'sent' && (
          <div style={{ textAlign: 'center' }}>
            <div style={s.checkmark}>✓</div>
            <button type="button" style={{ ...s.btn, marginTop: 20 }}
              onClick={() => { setMode('login'); setError(''); setMessage('') }}>
              Back to Sign In
            </button>
          </div>
        )}

        <div style={s.note}>
          Private pool — for invited members only. Contact the admin if you need access.
        </div>
      </div>
    </div>
  )
}

const s = {
  outer: { minHeight: 'calc(100vh - 58px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F2F4F7' },
  card: { background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' },
  logoWrap: { marginBottom: 16 },
  puck: { width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', display: 'inline-block' },
  appName: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, color: '#041E42', marginBottom: 4 },
  title: { fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 600, color: '#6B7A8D', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#9CAAB8', lineHeight: 1.5, marginBottom: 24 },
  input: { width: '100%', padding: '11px 14px', background: '#F8F9FB', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, color: '#041E42', fontSize: 15, marginBottom: 10, outline: 'none', display: 'block', textAlign: 'left' },
  btn: { width: '100%', padding: '12px', background: '#C8102E', color: 'white', border: 'none', borderRadius: 8, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  error: { color: '#FF8A9A', fontSize: 13, marginBottom: 10, textAlign: 'left', lineHeight: 1.4 },
  links: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, },
  link: { background: 'transparent', border: 'none', color: '#1A6BC4', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  checkmark: { width: 56, height: 56, background: 'rgba(29,158,117,0.2)', border: '1px solid #1D9E75', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#1D9E75' },
  note: { marginTop: 24, fontSize: 11, color: '#9CAAB8', lineHeight: 1.5, borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 16 },
}
