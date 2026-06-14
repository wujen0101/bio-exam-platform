import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStudentRecords, getExamSessions, deleteExamSession, clearAllStats } from '../firebase/records'
import { getQuestionsByIds, getAllQuestions } from '../firebase/questions'
import { UNITS } from '../utils/units'

// ── 練功專區 ──────────────────────────────────────────────────────────────────
// 從 question_id 提取 chapter id（格式 unit1_ch1_001 → ch1；unit1_001 → null）
function chapterFromQid(qid) {
  const parts = (qid ?? '').split('_')
  return parts.length === 3 ? parts[1] : null
}

function DrillSetup({ records, autoStarsMap = {}, onStart }) {
  const [conditions, setConditions]       = useState([])
  const [wrongThreshold, setWrongThreshold] = useState(2)
  const [rateThreshold, setRateThreshold]   = useState(60)
  const [starsThreshold, setStarsThreshold] = useState(3)
  const [selectedChapters, setSelectedChapters] = useState([])  // [] = 全部
  const [expandedUnits, setExpandedUnits]       = useState([])  // 展開的單元
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg]   = useState('')

  function toggleCond(key) {
    setConditions(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }

  // 切換整個單元（全選/全消該單元所有章節）
  function toggleUnit(u) {
    const chIds = u.chapters.map(c => c.id)
    const allSelected = chIds.every(id => selectedChapters.includes(id))
    if (allSelected) {
      setSelectedChapters(prev => prev.filter(id => !chIds.includes(id)))
    } else {
      setSelectedChapters(prev => [...new Set([...prev, ...chIds])])
    }
  }

  // 切換單一章節
  function toggleChapter(chId) {
    setSelectedChapters(prev =>
      prev.includes(chId) ? prev.filter(id => id !== chId) : [...prev, chId]
    )
  }

  function toggleUnitExpand(uid) {
    setExpandedUnits(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])
  }

  // 判斷一筆 record 是否符合章節篩選
  function recordInScope(r) {
    if (selectedChapters.length === 0) return true
    const ch = chapterFromQid(r.question_id)
    if (ch) return selectedChapters.includes(ch)
    // 無 chapter（整單元題）：該單元任一章被選中即納入
    return UNITS.find(u => u.id === r.unit)?.chapters.some(c => selectedChapters.includes(c.id)) ?? false
  }

  async function handleStart() {
    if (conditions.length === 0) { setErrMsg('請至少選擇一個篩選條件。'); return }
    setErrMsg('')
    setLoading(true)

    try {
      const matched = new Set()
      const recordConds = conditions.filter(c => c !== 'stars_gte')

      for (const r of records) {
        if (!recordInScope(r)) continue
        if (recordConds.includes('bookmarked') && r.bookmarked) matched.add(r.question_id)
        if (recordConds.includes('fuzzy')      && r.fuzzy)      matched.add(r.question_id)
        if (recordConds.includes('wrong_gt')   && (r.wrong_count ?? 0) >= wrongThreshold) matched.add(r.question_id)
        if (recordConds.includes('rate_lt') && (r.attempt_count ?? 0) > 0) {
          const rate = Math.round((r.correct_count ?? 0) / r.attempt_count * 100)
          if (rate <= rateThreshold) matched.add(r.question_id)
        }
      }

      if (conditions.includes('stars_gte')) {
        const allQs = await getAllQuestions()
        for (const q of allQs) {
          if (selectedChapters.length > 0) {
            const inScope = selectedChapters.includes(q.chapter) ||
              (!q.chapter && UNITS.find(u => u.id === q.unit)?.chapters.some(c => selectedChapters.includes(c.id)))
            if (!inScope) continue
          }
          if ((q.auto_stars ?? 0) >= starsThreshold) matched.add(q.id)
        }
      }

      const ids = [...matched]
      if (ids.length === 0) { setErrMsg('沒有符合條件的題目，請調整篩選設定。'); return }

      const qs = await getQuestionsByIds(ids)
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]]
      }
      onStart(qs)
    } catch (e) {
      setErrMsg(`載入失敗：${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const previewCount = (() => {
    if (conditions.length === 0) return 0
    const matched = new Set()
    for (const r of records) {
      if (!recordInScope(r)) continue
      if (conditions.includes('bookmarked') && r.bookmarked) matched.add(r.question_id)
      if (conditions.includes('fuzzy')      && r.fuzzy)      matched.add(r.question_id)
      if (conditions.includes('wrong_gt')   && (r.wrong_count ?? 0) >= wrongThreshold) matched.add(r.question_id)
      if (conditions.includes('rate_lt') && (r.attempt_count ?? 0) > 0) {
        const rate = Math.round((r.correct_count ?? 0) / r.attempt_count * 100)
        if (rate <= rateThreshold) matched.add(r.question_id)
      }
      if (conditions.includes('stars_gte')) {
        const effective = (r.stars ?? 0) > 0 ? (r.stars ?? 0) : (autoStarsMap[r.question_id] ?? 0)
        if (effective >= starsThreshold) matched.add(r.question_id)
      }
    }
    return matched.size
  })()

  const CONDS = [
    { key: 'bookmarked', label: '★ 收藏標記', color: 'yellow' },
    { key: 'fuzzy',      label: '? 模糊標記', color: 'purple' },
    { key: 'wrong_gt',   label: '錯題次數',   color: 'red' },
    { key: 'rate_lt',    label: '答對率',      color: 'blue' },
    { key: 'stars_gte',  label: '★ 星號等級', color: 'amber' },
  ]
  const btnActive = {
    yellow: 'bg-yellow-400 border-yellow-400 text-white',
    purple: 'bg-purple-500 border-purple-500 text-white',
    red:    'bg-red-500 border-red-500 text-white',
    blue:   'bg-blue-500 border-blue-500 text-white',
    amber:  'bg-amber-500 border-amber-500 text-white',
  }
  const btnIdle = 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'

  return (
    <div className="space-y-5 max-w-2xl">
      {/* 篩選條件 */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="font-semibold text-gray-700 mb-3">篩選條件 <span className="text-xs text-gray-400 font-normal">（可複選，取聯集）</span></div>
        <div className="flex flex-wrap gap-2 mb-4">
          {CONDS.map(({ key, label, color }) => {
            const active = conditions.includes(key)
            return (
              <button key={key} onClick={() => toggleCond(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${active ? btnActive[color] : btnIdle}`}>
                {label}
              </button>
            )
          })}
        </div>
        {conditions.includes('wrong_gt') && (
          <div className="flex items-center gap-3 mb-3 pl-1">
            <span className="text-sm text-gray-600 whitespace-nowrap">錯題次數 &ge;</span>
            <input type="number" min={0} max={99} value={wrongThreshold}
              onChange={e => setWrongThreshold(Number(e.target.value))}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1 text-sm text-center focus:ring-2 focus:ring-red-300 outline-none"
            />
            <span className="text-sm text-gray-400">次</span>
          </div>
        )}
        {conditions.includes('rate_lt') && (
          <div className="flex items-center gap-3 mb-3 pl-1">
            <span className="text-sm text-gray-600 whitespace-nowrap">答對率 &le;</span>
            <input type="number" min={0} max={100} value={rateThreshold}
              onChange={e => setRateThreshold(Number(e.target.value))}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1 text-sm text-center focus:ring-2 focus:ring-blue-300 outline-none"
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
        )}
        {conditions.includes('stars_gte') && (
          <div className="flex items-center gap-3 mb-3 pl-1">
            <span className="text-sm text-gray-600 whitespace-nowrap">星號等級 &ge;</span>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setStarsThreshold(n)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold border transition
                    ${starsThreshold === n ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-400 hover:border-amber-300'}`}>
                  {n}
                </button>
              ))}
            </div>
            <span className="text-sm text-amber-500">{'★'.repeat(starsThreshold)}</span>
          </div>
        )}
      </div>

      {/* 單元範圍 */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="font-semibold text-gray-700 mb-3">
          單元範圍 <span className="text-xs text-gray-400 font-normal">（不選 = 全部）</span>
          {selectedChapters.length > 0 && (
            <button onClick={() => setSelectedChapters([])}
              className="ml-2 text-xs text-gray-400 underline hover:text-gray-600">清除</button>
          )}
        </div>
        <div className="space-y-1">
          {UNITS.map(u => {
            const chIds      = u.chapters.map(c => c.id)
            const allSel     = chIds.every(id => selectedChapters.includes(id))
            const someSel    = chIds.some(id => selectedChapters.includes(id))
            const isExpanded = expandedUnits.includes(u.id)
            return (
              <div key={u.id} className="border border-gray-100 rounded-xl overflow-hidden">
                {/* 單元列 */}
                <div className="flex items-center gap-2 px-3 py-2">
                  {/* 單元 checkbox */}
                  <button onClick={() => toggleUnit(u)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 text-xs transition
                      ${allSel ? 'border-primary bg-primary text-white'
                        : someSel ? 'border-primary bg-green-100 text-primary'
                        : 'border-gray-300 hover:border-primary'}`}>
                    {allSel ? '✓' : someSel ? '–' : ''}
                  </button>
                  {/* 單元名稱（點擊展開章節） */}
                  <button onClick={() => toggleUnitExpand(u.id)}
                    className="flex-1 flex items-center gap-2 text-left">
                    <span className={`text-sm font-medium ${allSel || someSel ? 'text-primary' : 'text-gray-700'}`}>
                      {u.name}
                    </span>
                    <span className="text-xs text-gray-400">{u.title_zh}</span>
                    <span className="ml-auto text-gray-300 text-xs">{isExpanded ? '▾' : '▸'}</span>
                  </button>
                </div>
                {/* 章節列表 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-3 pb-2 pt-1 flex flex-col gap-0.5 bg-gray-50">
                    {u.chapters.map(ch => {
                      const sel = selectedChapters.includes(ch.id)
                      return (
                        <button key={ch.id} onClick={() => toggleChapter(ch.id)}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition
                            ${sel ? 'bg-green-50' : 'hover:bg-white'}`}>
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 text-xs transition
                            ${sel ? 'border-primary bg-primary text-white' : 'border-gray-300 hover:border-primary'}`}>
                            {sel && '✓'}
                          </span>
                          <span className={`text-xs font-medium w-8 shrink-0 ${sel ? 'text-primary' : 'text-gray-400'}`}>Ch{ch.no}</span>
                          <span className={`text-xs ${sel ? 'text-green-800' : 'text-gray-500'}`}>{ch.en}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{errMsg}</div>
      )}

      <button onClick={handleStart} disabled={loading || conditions.length === 0}
        className="w-full py-3 rounded-xl bg-primary text-white font-bold text-base hover:bg-green-800 disabled:opacity-40 transition">
        {loading ? '載入中…' : conditions.length === 0 ? '請選擇篩選條件' : `開始練功（預估 ${previewCount} 題）`}
      </button>
    </div>
  )
}

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

// ── 單題完整內容 Modal ────────────────────────────────────────────────────────
function QuestionDetailModal({ q, stat, onClose }) {
  const opts = ['A', 'B', 'C', 'D', 'E'].filter(k => q.options?.[k]?.en || q.options?.[k]?.zh)
  function optText(k) {
    const o = q.options?.[k]
    if (!o) return '—'
    return [o.en, o.zh].filter(Boolean).join('　')
  }
  const rate = pct(stat?.correct_count ?? 0, stat?.attempt_count ?? 0)

  // 星號：手動星號優先，否則用 auto_stars
  const manualStars = stat?.stars ?? 0
  const displayStars = manualStars > 0 ? manualStars : (q.auto_stars ?? 0)
  const isManualStar = manualStars > 0
  const note = stat?.note ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        {/* 頭部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{q.unit}</span>
            {q.sources?.length > 0 && (
              <span className="text-xs text-gray-400">・{q.sources.join('、')}</span>
            )}
            {displayStars > 0 && (
              <span className={`text-sm ${isManualStar ? 'text-amber-400' : 'text-amber-200'}`}>
                {'★'.repeat(displayStars)}
                <span className="text-xs text-gray-400 ml-1">{isManualStar ? '（自訂）' : '（自動）'}</span>
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 作答統計 */}
          {stat && (
            <div className="flex gap-3 text-center text-xs">
              <div className="flex-1 bg-gray-50 rounded-xl py-2">
                <div className={`text-xl font-black ${rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>{rate}%</div>
                <div className="text-gray-400">答對率</div>
              </div>
              <div className="flex-1 bg-green-50 rounded-xl py-2">
                <div className="text-xl font-black text-green-700">{stat.correct_count ?? 0}</div>
                <div className="text-green-600">答對</div>
              </div>
              <div className="flex-1 bg-red-50 rounded-xl py-2">
                <div className="text-xl font-black text-red-500">{stat.wrong_count ?? 0}</div>
                <div className="text-red-400">答錯</div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl py-2">
                <div className="text-xl font-black text-gray-600">{stat.attempt_count ?? 0}</div>
                <div className="text-gray-400">作答次數</div>
              </div>
            </div>
          )}

          {/* 備註 */}
          {note && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800">
              📝 {note}
            </div>
          )}

          {/* 題目 */}
          {q.question_zh && <p className="text-sm text-gray-800 leading-relaxed font-medium">{q.question_zh}</p>}
          {q.question_en && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed">
              {q.question_en}
            </div>
          )}

          {/* 選項 */}
          <div className="space-y-1.5">
            {opts.map(k => (
              <div key={k}
                className={`flex gap-2 px-3 py-2 rounded-lg text-sm border
                  ${k === q.answer ? 'border-green-400 bg-green-50 text-green-800 font-semibold' : 'border-gray-100 text-gray-600'}`}>
                <span className="font-bold shrink-0">{k}.</span>
                <span>{optText(k)}</span>
                {k === q.answer && <span className="ml-auto shrink-0 text-green-600">✓ 正確</span>}
              </div>
            ))}
          </div>

          {/* 解說 */}
          {q.explanations && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500">選項解說</div>
              {opts.map(k => q.explanations[k] && (
                <div key={k} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="font-bold shrink-0">{k}.</span>
                  <span>{q.explanations[k]}</span>
                </div>
              ))}
            </div>
          )}

          {/* 記憶口訣 */}
          {q.memory_tips && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              🧠 {q.memory_tips}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 單元練習明細 Modal ────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'wrong_desc',  label: '答錯數↓' },
  { key: 'stars_desc',  label: '星號↓' },
  { key: 'bookmarked',  label: '★ 收藏' },
  { key: 'fuzzy',       label: '? 模糊' },
]

function UnitDetailModal({ unit, records, onClose }) {
  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ]   = useState(true)
  const [selectedQ, setSelectedQ] = useState(null)
  const [sortKeys, setSortKeys]   = useState([])   // 多選排序，順序即優先順序

  // 本單元的 records（已有統計）
  const unitRecords = records.filter(r => r.unit === unit.id)
  const statMap = Object.fromEntries(unitRecords.map(r => [r.question_id, r]))

  useEffect(() => {
    const ids = unitRecords.map(r => r.question_id)
    getQuestionsByIds(ids)
      .then(qs => setQuestions(qs.sort((a, b) => (a.question_no ?? 0) - (b.question_no ?? 0))))
      .finally(() => setLoadingQ(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id])

  function toggleSort(key) {
    setSortKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  // 依 sortKeys 順序做多鍵排序
  const sortedQuestions = [...questions].sort((a, b) => {
    for (const key of sortKeys) {
      const sa = statMap[a.id] ?? {}, sb = statMap[b.id] ?? {}
      let diff = 0
      if (key === 'wrong_desc') {
        diff = (sb.wrong_count ?? 0) - (sa.wrong_count ?? 0)
      } else if (key === 'stars_desc') {
        const starA = (sa.stars ?? 0) > 0 ? (sa.stars ?? 0) : (a.auto_stars ?? 0)
        const starB = (sb.stars ?? 0) > 0 ? (sb.stars ?? 0) : (b.auto_stars ?? 0)
        diff = starB - starA
      } else if (key === 'bookmarked') {
        diff = (sb.bookmarked ? 1 : 0) - (sa.bookmarked ? 1 : 0)
      } else if (key === 'fuzzy') {
        diff = (sb.fuzzy ? 1 : 0) - (sa.fuzzy ? 1 : 0)
      }
      if (diff !== 0) return diff
    }
    return 0
  })

  const unitAttempt = unitRecords.reduce((s, r) => s + (r.attempt_count || 0), 0)
  const unitCorrect = unitRecords.reduce((s, r) => s + (r.correct_count || 0), 0)
  const unitRate    = pct(unitCorrect, unitAttempt)

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-3 py-6 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
          {/* 頭部 */}
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-gray-800">{unit.name} {unit.title_zh}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  練習 {unitRecords.length} 題・{unitAttempt} 題次・答對率
                  <span className={`ml-1 font-semibold ${unitRate >= 80 ? 'text-green-600' : unitRate >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {unitRate}%
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {/* 排序選項 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 shrink-0">排序：</span>
              {SORT_OPTIONS.map(({ key, label }, idx) => {
                const active = sortKeys.includes(key)
                const order  = sortKeys.indexOf(key) + 1
                return (
                  <button key={key} onClick={() => toggleSort(key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition
                      ${active
                        ? key === 'bookmarked' ? 'bg-yellow-400 border-yellow-400 text-white'
                          : key === 'fuzzy'    ? 'bg-purple-500 border-purple-500 text-white'
                          : 'bg-primary border-primary text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {active && <span className="opacity-80">{order}.</span>}
                    {label}
                  </button>
                )
              })}
              {sortKeys.length > 0 && (
                <button onClick={() => setSortKeys([])}
                  className="text-xs text-gray-400 underline hover:text-gray-600">重設</button>
              )}
            </div>
          </div>

          {/* 題目列表 */}
          <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
            {loadingQ ? (
              <div className="text-center py-10 text-gray-400">載入中…</div>
            ) : sortedQuestions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">找不到題目資料</div>
            ) : sortedQuestions.map(q => {
              const st = statMap[q.id] ?? {}
              const r  = pct(st.correct_count ?? 0, st.attempt_count ?? 0)
              const preview = (q.question_zh || q.question_en || '').slice(0, 50)
              const manualStars = st.stars ?? 0
              const dispStars   = manualStars > 0 ? manualStars : (q.auto_stars ?? 0)
              const isManual    = manualStars > 0
              return (
                <button key={q.id} onClick={() => setSelectedQ(q)}
                  className="w-full text-left px-5 py-3 hover:bg-gray-50 transition flex items-center gap-3">
                  <div className={`shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center font-black text-white text-xs ${scoreBg(r)}`}>
                    <span className="text-base leading-none">{r}</span>
                    <span className="opacity-80">%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-sm text-gray-700 truncate">{preview || '（無題目文字）'}</span>
                      {dispStars > 0 && (
                        <span className={`shrink-0 text-xs ${isManual ? 'text-amber-400' : 'text-amber-200'}`}>
                          {'★'.repeat(dispStars)}
                        </span>
                      )}
                      {st.bookmarked && <span className="shrink-0 bg-yellow-400 text-white text-xs font-bold px-1.5 py-0.5 rounded">★</span>}
                      {st.fuzzy      && <span className="shrink-0 bg-purple-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">?</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span>答對 <span className="text-green-600 font-medium">{st.correct_count ?? 0}</span></span>
                      <span>答錯 <span className="text-red-400 font-medium">{st.wrong_count ?? 0}</span></span>
                      <span>作答 {st.attempt_count ?? 0} 次</span>
                      {st.note && <span className="text-blue-400">📝</span>}
                    </div>
                  </div>
                  <span className="text-gray-300 shrink-0">›</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 題目詳細 Modal（疊在上層） */}
      {selectedQ && (
        <QuestionDetailModal
          q={selectedQ}
          stat={statMap[selectedQ.id]}
          onClose={() => setSelectedQ(null)}
        />
      )}
    </>
  )
}

// ── 單次測驗紀錄列 ────────────────────────────────────────────────────────────
function SessionRow({ session, onDelete, deleting }) {
  const [expanded, setExpanded] = useState(false)
  const [questions, setQuestions] = useState(null)   // null = 尚未載入
  const [loadingQ, setLoadingQ]   = useState(false)

  const rate = session.score ?? pct(session.correct, session.total)
  const date = session.created_at?.seconds
    ? new Date(session.created_at.seconds * 1000).toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'
  const modeLabel = session.mode === 'mock' ? '🎯 模擬考' : '📝 單元測驗'
  // 將章節依所屬單元分組，產生 "Unit 1 (Ch1、Ch2)・Unit 2 (Ch4)" 格式
  const scopeLabel = (() => {
    const chapters = session.chapters ?? []
    const units    = session.units    ?? []
    if (chapters.length === 0 && units.length === 0) return ''

    const parts = []

    // 先處理有章節的單元（chapters 欄位）
    const handledUnits = new Set()
    for (const u of UNITS) {
      const unitChs = u.chapters.filter(c => chapters.includes(c.id))
      if (unitChs.length === 0) continue
      handledUnits.add(u.id)
      const chStr = unitChs.map(c => `Ch${c.no}`).join('、')
      parts.push(`${u.name} (${chStr})`)
    }

    // 再處理整單元（units 欄位，且未被章節分組涵蓋）
    for (const uid of units) {
      if (handledUnits.has(uid)) continue
      const u = UNITS.find(u => u.id === uid)
      parts.push(u?.name ?? uid)
    }

    return parts.join('・')
  })()

  const [selectedIdx, setSelectedIdx] = useState(null)  // 點選的題目 index

  // 從 question 物件取得 "Unit 1 (Ch1)" 格式字串
  function qScopeLabel(q) {
    if (!q) return ''
    const u = UNITS.find(u => u.id === q.unit)
    if (!u) return q.unit ?? ''
    const ch = q.chapter ? u.chapters.find(c => c.id === q.chapter) : null
    return ch ? `${u.name} (Ch${ch.no})` : u.name
  }

  async function handleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && questions === null && session.detail?.length) {
      setLoadingQ(true)
      try {
        const ids = session.detail.map(d => d.question_id).filter(Boolean)
        const qs  = await getQuestionsByIds(ids)
        setQuestions(Object.fromEntries(qs.map(q => [q.id, q])))
      } catch { setQuestions({}) }
      finally { setLoadingQ(false) }
    }
  }

  const selectedDetail = selectedIdx != null ? session.detail[selectedIdx] : null
  const selectedQ      = selectedDetail ? questions?.[selectedDetail.question_id] : null

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* 摘要列 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <button
          onClick={handleExpand}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-white text-sm ${scoreBg(rate)}`}>
            <span className="text-lg leading-none">{rate}</span>
            <span className="text-xs font-normal opacity-80">分</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-700">{modeLabel}</span>
              {scopeLabel && <span className="text-xs text-gray-400 truncate">{scopeLabel}</span>}
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

      {/* 展開：逐題列表（點選才顯示詳細） */}
      {expanded && session.detail && (
        <div className="border-t border-gray-100 bg-gray-50">
          {loadingQ ? (
            <div className="text-center py-6 text-gray-400 text-sm">載入中…</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {session.detail.map((d, i) => (
                <button key={i} onClick={() => setSelectedIdx(i)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white transition text-left">
                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs
                    ${d.is_correct ? 'bg-green-100 text-green-700' :
                      d.user_ans ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                    {d.is_correct ? '✓' : d.user_ans ? '✗' : '—'}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">第 {i + 1} 題</span>
                  <span className="flex-1 text-xs truncate text-gray-500">
                    {questions?.[d.question_id]?.question_zh || questions?.[d.question_id]?.question_en || ''}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">
                    {qScopeLabel(questions?.[d.question_id])}
                  </span>
                  <span className="text-gray-300 text-xs shrink-0">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 點選題目後的詳細 Modal */}
      {selectedIdx != null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            {/* 頭部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs
                  ${selectedDetail?.is_correct ? 'bg-green-100 text-green-700' :
                    selectedDetail?.user_ans ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400'}`}>
                  {selectedDetail?.is_correct ? '✓' : selectedDetail?.user_ans ? '✗' : '—'}
                </span>
                <span className="font-semibold text-gray-700">第 {selectedIdx + 1} 題</span>
                <span className="text-xs text-gray-400">{qScopeLabel(selectedQ)}</span>
                {selectedQ?.sources?.length > 0 && (
                  <span className="text-xs text-gray-400">・{selectedQ.sources.join('、')}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
                  disabled={selectedIdx === 0}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30">◀</button>
                <button onClick={() => setSelectedIdx(i => Math.min(session.detail.length - 1, i + 1))}
                  disabled={selectedIdx === session.detail.length - 1}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30">▶</button>
                <button onClick={() => setSelectedIdx(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-1">✕</button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {selectedQ ? (() => {
                const d    = selectedDetail
                const opts = ['A','B','C','D','E'].filter(k => selectedQ.options?.[k]?.en || selectedQ.options?.[k]?.zh)
                function optText(k) {
                  const o = selectedQ.options?.[k]
                  if (!o) return '—'
                  return [o.zh, o.en].filter(Boolean).join('　')
                }
                return (
                  <>
                    {/* 題目 */}
                    {selectedQ.question_zh && <p className="text-sm text-gray-800 leading-relaxed font-medium">{selectedQ.question_zh}</p>}
                    {selectedQ.question_en && <p className="text-xs text-gray-500 leading-relaxed bg-blue-50 rounded-lg px-3 py-2">{selectedQ.question_en}</p>}

                    {/* 選項 */}
                    <div className="space-y-1.5">
                      {opts.map(k => {
                        const isCorrect = k === d.correct_ans
                        const isUser    = k === d.user_ans
                        const isWrong   = isUser && !isCorrect
                        return (
                          <div key={k} className={`flex gap-2 px-3 py-2 rounded-lg text-sm border
                            ${isCorrect ? 'border-green-400 bg-green-50 text-green-800 font-semibold'
                              : isWrong ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-gray-100 text-gray-600'}`}>
                            <span className="font-bold shrink-0">{k}.</span>
                            <span className="flex-1">{optText(k)}</span>
                            {isCorrect && <span className="shrink-0 text-green-600 text-xs">✓ 正確</span>}
                            {isWrong   && <span className="shrink-0 text-red-400 text-xs">✗ 你的答案</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* 解說 */}
                    {selectedQ.explanations && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-500">選項解說</div>
                        {opts.map(k => selectedQ.explanations[k] && (
                          <div key={k} className="text-xs text-gray-600 flex gap-1.5">
                            <span className="font-bold shrink-0">{k}.</span>
                            <span>{selectedQ.explanations[k]}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 記憶口訣 */}
                    {selectedQ.memory_tips && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        🧠 {selectedQ.memory_tips}
                      </div>
                    )}
                  </>
                )
              })() : (
                <p className="text-sm text-gray-400 text-center py-6">（題目資料未找到）</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function RecordPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('stats')           // stats | sessions | drill
  const [records, setRecords]   = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [unitDetail, setUnitDetail] = useState(null)   // 點選的單元
  const [autoStarsMap, setAutoStarsMap] = useState({}) // { questionId → auto_stars }

  useEffect(() => {
    if (authLoading || !user) return
    Promise.all([
      getStudentRecords(user.uid),
      getExamSessions(user.uid),
    ])
      .then(([recs, sess]) => {
        setRecords(recs)
        setSessions(sess)
        // 非同步補拉 question 的 auto_stars（不擋主畫面）
        const ids = recs.map(r => r.question_id).filter(Boolean)
        if (ids.length > 0) {
          getQuestionsByIds(ids).then(qs => {
            const map = {}
            for (const q of qs) map[q.id] = q.auto_stars ?? 0
            setAutoStarsMap(map)
          }).catch(() => {})
        }
      })
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
    } catch (e) {
      console.error('deleteExamSession 部分失敗：', e.message)
    } finally {
      // 無論成功或部分失敗，都從 UI 移除並重載統計
      setSessions(prev => prev.filter(s => s.id !== session.id))
      try {
        const recs = await getStudentRecords(user.uid)
        setRecords(recs)
      } catch {}
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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 flex-wrap">
        {[
          { key: 'stats',    label: '📈 統計總覽' },
          { key: 'sessions', label: `🗂 作答紀錄（${sessions.length}）` },
          { key: 'drill',    label: '💪 練功專區' },
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
          <p className="text-xs text-gray-400 mb-2">點選單元可查看練習過的題目明細</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
            {UNITS.map(u => {
              const s = unitStats[u.id]
              if (!s || s.attempt === 0) return (
                <div key={u.id} className="bg-white rounded-xl shadow px-4 py-3 opacity-40">
                  <div className="text-sm font-semibold text-gray-500">{u.name} {u.title_zh}</div>
                  <div className="text-xs text-gray-400 mt-0.5">尚未練習</div>
                </div>
              )
              return (
                <button key={u.id} onClick={() => setUnitDetail(u)}
                  className="text-left w-full hover:ring-2 hover:ring-primary/30 rounded-xl transition">
                  <UnitCard unit={u} stats={s} />
                </button>
              )
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

      {/* 單元明細 Modal */}
      {unitDetail && (
        <UnitDetailModal
          unit={unitDetail}
          records={records}
          onClose={() => setUnitDetail(null)}
        />
      )}

      {/* ── Tab: 練功專區 ── */}
      {tab === 'drill' && (
        <DrillSetup
          records={records}
          autoStarsMap={autoStarsMap}
          onStart={qs => {
            sessionStorage.setItem('drill_questions', JSON.stringify(qs))
            navigate('/exam?mode=drill')
          }}
        />
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
