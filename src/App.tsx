import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Session from './pages/Session'
import Journey from './pages/Journey'
import Moments from './pages/Moments'
import Crisis from './pages/Crisis'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Settings from './pages/Settings'
import Donate from './pages/Donate'
import CrisisButton from './components/CrisisButton'

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-text-secondary animate-pulse">Opening the door...</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-bg-primary">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/session"
            element={<ProtectedRoute><Session /></ProtectedRoute>}
          />
          <Route
            path="/journey"
            element={<ProtectedRoute><Journey /></ProtectedRoute>}
          />
          <Route
            path="/moments"
            element={<ProtectedRoute><Moments /></ProtectedRoute>}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute><Settings /></ProtectedRoute>}
          />
          <Route path="/crisis" element={<Crisis />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CrisisButton />
      </div>
    </AuthProvider>
  )
}
