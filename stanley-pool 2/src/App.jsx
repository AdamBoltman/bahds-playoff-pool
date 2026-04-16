import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import TopBar from './components/TopBar.jsx'
import NavBar from './components/NavBar.jsx'
import LoginPage from './pages/LoginPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PicksPage from './pages/PicksPage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import ScoringPage from './pages/ScoringPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <span className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <span className="spinner" />
    </div>
  )

  return (
    <>
      <TopBar />
      {user && <NavBar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/picks" element={<ProtectedRoute><PicksPage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
        <Route path="/scoring" element={<ProtectedRoute><ScoringPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
