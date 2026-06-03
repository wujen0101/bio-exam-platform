import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStudentRecords, getExamSessions, deleteExamSession, clearAllStats } from '../firebase/records'
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

function scoreColor(rate) {
  return rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-500' : 'text-red-500'
}
function scoreBg(rate) {
  return rate >= 80 ? 'bg-green-400' : rate >= 60 ? 'bg-yellow-400' : 'bg-red-400'
}

// ── 各單元統計卡 ──────────────────────────────────────────────────────────────
function UnitCard({ unit, stats }) {
  const rate = pct(stats.correct, stats.attempt)
  const color = scoreBg(rate)
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
        <span className="text-xs text-gray-400 shrink-0">{stats.correct}/{stats.attempt} 題</span>
      </div>
    </div>
  )
}

// ── 單次測驗紀錄列 ────────────────────────────────────────────────────────────
function SessionRow({ session, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(false)
  const rate = session.score ?? pct(session.correct, session.total)
  const date = session.created_at?.seconds
    ? new Date(session.created_at.seconds * 1000).toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'
  const modeLabel = session.mode === 'mock' ? '🎯 模擬考' : '📝 單元測驗'
  const unitsLabel = (session.units ?? [])
    .map(uid => UNITS.find(u => u.id === uid)?.name ?? uid)
    .join('、')

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* 摘要列 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white text-sm ${scoreBg(rate)}`}>
            <span className="text-lg leading-none">{rate}</span>
            <span className="text-xs font-normal opacity-80">分</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-700">{modeLabel}</span>
              {unitsLabel && <span className="text-xs text-gray-400 truncate">{unitsLabel}</span>}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{date}</div>
            <div className="flex gap-3 mt-1 text-xs">
              <span className="text-green-600">✓ {session.correct} 對</span>
              <span className="text-red-500">✗ {session.wrong} 錯</span>
              {session.skip > 0 && <span className="text-gray-400">— {session.skip} 未答</span>}
              <span className="text-gray-400">共 {session.total} 題</span>
            </div>
          </div>
          <span className="text-gray-300 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
        </button>
        <button
          onClick={() => onDelete(session)}
          disabled={deleting}
          className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 disabled:opacity-40 transition"
        >
          {deleting ? '…' : '刪除'}
        </button>
      </div>

      {/* 展開：逐題明細 */}
      {expanded && session.detail && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-1 max-h-72 overflow-y-auto">
          <div className="text-xs text-gray-400 mb-2">逐題作答明細</div>
          {session.detail.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold
                ${d.is_correct ? 'bg-green-100 text-green-700' :
                  d.user_ans ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                {d.is_correct ? '✓' : d.user_ans ? '✗' : '—'}
              </span>
              <span className="text-gray-500 shrink-0">第 {i + 1} 題</span>
              <span className="text-gray-400 shrink-0">{d.unit}</span>
              {d.user_ans && (
                <span className={d.is_correct ? 'text-green-600' : 'text-red-400'}>
                  答 {d.user_ans}
                  {!d.is_correct && <span className="text-gray-400">（正確 {d.correct_ans}）</span>}
                </span>
              )}
              {!d.user_ans && <span className="text-gray-300">未作答</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function RecordPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('stats')           // stats | sessions
  const [records, setRecords]   = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    Promise.all([
      getStudentRecords(user.uid),
      getExamSessions(user.uid),
    ])
      .then(([recs, sess]) => { setRecords(recs); setSessions(sess) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, authLoading])

  const handleDeleteSession = useCallback(async (session) => {
    if (!window.confirm(
      `確定要刪除這筆作答紀錄（${session.total} 題）？\n此操作會從統計中扣除該次作答，無法復原。`
    )) return
    setDeletingId(session.id)
    try {
      await deleteExamSession(user.uid, session.id)
      setSessions(prev => prev.filter(s => s.id !== session.id))
      // 重新載入彙總統計
      const recs = await getStudentRecords(user.uid)
      setRecords(recs)
    } catch (e) {
      alert(`刪除失敗：${e.message}`)
    } finally {
      setDeletingId(null)
    }
  }, [user])

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin text-4xl">🧬</div>
      </div>
    )
  }

  if (records.length === 0 && sessions.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-500 mb-2">還沒有作答紀錄</p>
        <p className="text-gray-400 text-sm mb-6">完成一次測驗後，這裡會顯示你的學習進度</p>
        <button onClick={() => navigate('/')}
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-green-800 transition">
          去測驗
        </button>
      </div>
    )
  }

  // ── 統計計算 ──
  const totalAttempt = records.reduce((s, r) => s + (r.attempt_count || 0), 0)
  const totalCorrect = records.reduce((s, r) => s + (r.correct_count || 0), 0)
  const overallRate  = pct(totalCorrect, totalAttempt)

  const unitStats = {}
  for (const r of records) {
    if (!unitStats[r.unit]) unitStats[r.unit] = { attempt: 0, correct: 0 }
    unitStats[r.unit].attempt += r.attempt_count || 0
    unitStats[r.unit].correct += r.correct_count || 0
  }

  const weakUnits = UNITS.filter(u => {
    const s = unitStats[u.id]
    return s && s.attempt > 0 && pct(s.correct, s.attempt) < 60
  })

  const sc = scoreColor(overallRate)

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">📊 我的學習紀錄</h1>
      <p className="text-gray-400 text-sm mb-4">{user.displayName} 的答題統計</p>

      {/* Tab 切換 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'stats',    label: '📈 統計總覽' },
          { key: 'sessions', label: `🗂 作答紀錄（${sessions.length}）` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: 統計總覽 ── */}
      {tab === 'stats' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl shadow p-4 text-center">
              <div className={`text-4xl font-black ${sc}`}>{overallRate}%</div>
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

          {weakUnits.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
              <div className="font-semibold text-amber-800 mb-2">⚠️ 弱點單元（答對率 &lt; 60%）</div>
              <div className="flex flex-wrap gap-2">
                {weakUnits.map(u => (
                  <button key={u.id}
                    onClick={() => navigate(`/exam?mode=unit&units=${u.id}`)}
                    className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg transition">
                    {u.name} {u.title_zh}（{pct(unitStats[u.id].correct, unitStats[u.id].attempt)}%）
                  </button>
                ))}
              </div>
              <p className="text-xs text-amber-600 mt-2">點擊單元名稱可直接進行練習</p>
            </div>
          )}

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

          <div className="bg-white rounded-2xl shadow px-5 py-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-700">繼續練習</div>
              <div className="text-sm text-gray-400">從弱點單元或全部單元重新測驗</div>
            </div>
            <button onClick={() => navigate('/')}
              className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-800 transition text-sm font-medium">
              選擇測驗
            </button>
          </div>

          {/* 危險操作：重設統計 */}
          <div className="border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between bg-red-50/40">
            <div>
              <div className="font-semibold text-red-700 text-sm">重設作答統計</div>
              <div className="text-xs text-red-400 mt-0.5">清除所有答對／答錯累計，備註與星號不受影響</div>
            </div>
            <button
              disabled={clearing}
              onClick={async () => {
                if (!window.confirm('確定要清除所有作答統計？此操作無法復原。')) return
                setClearing(true)
                try {
                  await clearAllStats(user.uid)
                  setRecords([])
                } catch (e) {
                  alert(`清除失敗：${e.message}`)
                } finally {
                  setClearing(false)
                }
              }}
              className="text-sm px-4 py-2 rounded-lg border border-red-300 text-red-500 hover:bg-red-100 disabled:opacity-40 transition whitespace-nowrap">
              {clearing ? '清除中…' : '清除統計'}
            </button>
          </div>
        </>
      )}

      {/* ── Tab: 作答紀錄 ── */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>尚無作答紀錄</p>
              <p className="text-xs mt-1">完成一次測驗後會自動記錄</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-3">
                共 {sessions.length} 筆紀錄・刪除後會從統計中扣除該次作答，備註與星號標記不受影響
              </p>
              {sessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onDelete={handleDeleteSession}
                  deleting={deletingId === s.id}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
