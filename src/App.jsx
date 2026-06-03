import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ExamPage from './pages/ExamPage'
import ResultPage from './pages/ResultPage'
import RecordPage from './pages/RecordPage'
import AdminPage from './pages/AdminPage'
import Navbar from './components/Navbar'
import { useAuth } from './context/AuthContext'

// 老師 UID 白名單（從 Firebase Console → Authentication 取得）
const ADMIN_UIDS = import.meta.env.VITE_ADMIN_UIDS?.split(',') ?? []

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !ADMIN_UIDS.includes(user.uid)) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-gray-600 font-medium">你沒有權限存取此頁面</p>
      </div>
    )
  }
  return children
}

function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin text-4xl">🧬</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/record" element={
            <ProtectedRoute><RecordPage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  )
}

export default App
