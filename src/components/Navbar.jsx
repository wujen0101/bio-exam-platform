import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logout } from '../firebase/auth'

function Navbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/')
  }

  const linkClass = (path) =>
    `block px-3 py-2 rounded-lg text-sm transition hover:bg-white/20 ${
      location.pathname === path ? 'bg-white/20 font-semibold' : ''
    }`

  return (
    <nav className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold tracking-wide leading-tight" onClick={() => setOpen(false)}>
          🧬 <span className="hidden xs:inline">後中醫生物學測驗平台</span>
          <span className="xs:hidden">生物學測驗</span>
        </Link>

        {/* 桌面版選單 */}
        <div className="hidden sm:flex items-center gap-1 text-sm">
          <Link to="/" className={linkClass('/')}>首頁</Link>
          {user && <Link to="/record" className={linkClass('/record')}>學習紀錄</Link>}
          {user && <Link to="/admin" className={linkClass('/admin')}>老師後台</Link>}

          {user ? (
            <div className="flex items-center gap-2 ml-2">
              {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName}
                  className="w-7 h-7 rounded-full border-2 border-white/50" />
              )}
              <span className="opacity-90 max-w-[8rem] truncate text-xs">{user.displayName}</span>
              <button onClick={handleLogout}
                className="bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition text-xs">
                登出
              </button>
            </div>
          ) : (
            <Link to="/login" className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition ml-2">
              登入
            </Link>
          )}
        </div>

        {/* 手機版 hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg hover:bg-white/20 transition"
          onClick={() => setOpen(v => !v)}
          aria-label="選單"
        >
          <div className={`w-5 h-0.5 bg-white transition-all ${open ? 'rotate-45 translate-y-1.5' : ''}`} />
          <div className={`w-5 h-0.5 bg-white my-1 transition-all ${open ? 'opacity-0' : ''}`} />
          <div className={`w-5 h-0.5 bg-white transition-all ${open ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </div>

      {/* 手機版下拉選單 */}
      {open && (
        <div className="sm:hidden border-t border-white/20 px-4 pb-3 pt-2 space-y-1">
          <Link to="/" className={linkClass('/')} onClick={() => setOpen(false)}>首頁</Link>
          {user && <Link to="/record" className={linkClass('/record')} onClick={() => setOpen(false)}>學習紀錄</Link>}
          {user && <Link to="/admin" className={linkClass('/admin')} onClick={() => setOpen(false)}>老師後台</Link>}

          <div className="border-t border-white/20 mt-2 pt-2">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {user.photoURL && (
                    <img src={user.photoURL} alt={user.displayName}
                      className="w-7 h-7 rounded-full border-2 border-white/50" />
                  )}
                  <span className="text-sm opacity-90 truncate max-w-[10rem]">{user.displayName}</span>
                </div>
                <button onClick={handleLogout}
                  className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm transition">
                  登出
                </button>
              </div>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)}
                className="block text-center bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition text-sm">
                登入
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
