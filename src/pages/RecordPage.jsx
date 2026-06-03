import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStudentRecords } from '../firebase/records'
import { UNITS } from '../utils/units'

// ── 工具 ──────────────────────────────────────────────────────────────────────
function pct(correct, attempt) {
  if (!attempt) return 0
  return Math.round((correct / attempt) * 100)
}

function RateBar({ value, color = 'bg-primary' }) {
  return (
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ── 各單元統計卡 ──────────────────────────────────────────────────────────────
function UnitCard({ unit, stats }) {
  const rate = pct(stats.correct, stats.attempt)
  const color = rate >= 80 ? 'bg-green-400' : rate >= 60 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="bg-white rounded-xl shadow px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-800">{unit.name} {unit.title_zh}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${color}`}>
          {rate}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <RateBar value={rate} color={color} />
        <span className="text-xs text-gray-400 shrink-0">
          {stats.correct}/{stats.attempt} 題
        </span>
      </div>
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function RecordPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return
    getStudentRecords(user.uid)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin text-4xl">🧬</div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-500 mb-2">還沒有作答紀錄</p>
        <p className="text-gray-400 text-sm mb-6">完成一次測驗後，這裡會顯示你的學習進度</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-green-800 transition"
        >
          去測驗
        </button>
      </div>
    )
  }

  // ── 統計計算 ──
  const totalAttempt = records.reduce((s, r) => s + (r.attempt_count || 0), 0)
  const totalCorrect = records.reduce((s, r) => s + (r.correct_count || 0), 0)
  const overallRate  = pct(totalCorrect, totalAttempt)

  // 各單元統計
  const unitStats = {}
  for (const r of records) {
    if (!unitStats[r.unit]) unitStats[r.unit] = { attempt: 0, correct: 0 }
    unitStats[r.unit].attempt += r.attempt_count || 0
    unitStats[r.unit].correct += r.correct_count || 0
  }

  // 弱點單元：答對率 < 60%，且有答過題
  const weakUnits = UNITS.filter(u => {
    const s = unitStats[u.id]
    return s && s.attempt > 0 && pct(s.correct, s.attempt) < 60
  })

  const scoreColor = overallRate >= 80 ? 'text-green-600' : overallRate >= 60 ? 'text-yellow-500' : 'text-red-500'

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">📊 我的學習紀錄</h1>
      <p className="text-gray-400 text-sm mb-6">{user.displayName} 的答題統計</p>

      {/* 總覽 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl shadow p-4 text-center">
          <div className={`text-4xl font-black ${scoreColor}`}>{overallRate}%</div>
          <div className="text-xs text-gray-400 mt-1">總體答對率</div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4 text-center">
          <div className="text-4xl font-black text-gray-700">{totalAttempt}</div>
          <div className="text-xs text-gray-400 mt-1">累計作答題次</div>
        </div>
        <div className="bg-white rounded-2xl shadow p-4 text-center">
          <div className="text-4xl font-black text-gray-700">{records.length}</div>
          <div className="text-xs text-gray-400 mt-1">練習過的題目</div>
        </div>
      </div>

      {/* 弱點提示 */}
      {weakUnits.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
          <div className="font-semibold text-amber-800 mb-2">⚠️ 弱點單元（答對率 &lt; 60%）</div>
          <div className="flex flex-wrap gap-2">
            {weakUnits.map(u => (
              <button
                key={u.id}
                onClick={() => navigate(`/exam?mode=unit&units=${u.id}`)}
                className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg transition"
              >
                {u.name} {u.title_zh}（{pct(unitStats[u.id].correct, unitStats[u.id].attempt)}%）
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">點擊單元名稱可直接進行練習</p>
        </div>
      )}

      {/* 各單元答對率 */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">各單元答對率</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
        {UNITS.map(u => {
          const s = unitStats[u.id]
          if (!s || s.attempt === 0) return (
            <div key={u.id} className="bg-white rounded-xl shadow px-4 py-3 opacity-40">
              <div className="text-sm font-semibold text-gray-500">{u.name} {u.title_zh}</div>
              <div className="text-xs text-gray-400 mt-0.5">尚未練習</div>
            </div>
          )
          return <UnitCard key={u.id} unit={u} stats={s} />
        })}
      </div>

      {/* 快速複習按鈕 */}
      <div className="bg-white rounded-2xl shadow px-5 py-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-700">繼續練習</div>
          <div className="text-sm text-gray-400">從弱點單元或全部單元重新測驗</div>
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-800 transition text-sm font-medium"
        >
          選擇測驗
        </button>
      </div>
    </div>
  )
}
