import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithGoogle } from '../firebase/auth'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 已登入直接跳回首頁
  if (user) {
    navigate('/', { replace: true })
    return null
  }

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      await loginWithGoogle()
      navigate('/', { replace: true })
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('登入失敗，請再試一次。')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow p-8 text-center">
      <div className="text-5xl mb-4">🧬</div>
      <h1 className="text-2xl font-bold mb-1">後中醫生物學測驗平台</h1>
      <p className="text-gray-500 mb-8 text-sm">使用 Google 帳號登入以記錄學習進度</p>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        className="flex items-center justify-center gap-3 w-full border rounded-lg py-3 hover:bg-gray-50 transition disabled:opacity-50"
      >
        {loading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
        )}
        <span>{loading ? '登入中…' : '使用 Google 帳號登入'}</span>
      </button>

      <p className="text-xs text-gray-400 mt-6">
        登入即代表你同意本平台記錄你的作答紀錄以供學習分析
      </p>
    </div>
  )
}

export default LoginPage
