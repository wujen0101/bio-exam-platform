import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../firebase/auth'

function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <nav className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-wide">
          🧬 後中醫生物學測驗平台
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:underline">首頁</Link>
          {user && <Link to="/record" className="hover:underline">學習紀錄</Link>}
          {user && <Link to="/admin" className="hover:underline">老師後台</Link>}

          {user ? (
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-7 h-7 rounded-full border-2 border-white/50"
                />
              )}
              <span className="hidden sm:inline opacity-90 max-w-[8rem] truncate">
                {user.displayName}
              </span>
              <button
                onClick={handleLogout}
                className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition text-xs"
              >
                登出
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
