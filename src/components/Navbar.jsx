import { Link } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-wide">
          🧬 後中醫生物學測驗平台
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/" className="hover:underline">首頁</Link>
          <Link to="/record" className="hover:underline">學習紀錄</Link>
          <Link to="/admin" className="hover:underline">老師後台</Link>
          <Link to="/login" className="hover:underline">登入</Link>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
