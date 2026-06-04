import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UNIT_MAP } from '../utils/units'
import { useAuth } from '../context/AuthContext'
import { getQuestionAnnotations, saveQuestionAnnotation } from '../firebase/records'

function optionText(question, opt) {
  const o = question.options?.[opt]
  if (!o) return '—'
  if (typeof o === 'string') return o
  return [o.en, o.zh].filter(Boolean).join('  ')
}

/** 依考古題出現次數自動計算星號（0 = 無來源）
 *  優先讀取匯入時寫入的 auto_stars 欄位，否則即時從 sources 長度計算
 */
function autoStars(q) {
  if (q.auto_stars != null) return q.auto_stars
  const n = (q.sources ?? []).length
  if (n >= 3) return 5
  if (n === 2) return 4
  if (n === 1) return 3
  return 0
}

// ── 星號選取元件 ──────────────────────────────────────────────────────────────
function StarPicker({ value, onChange, dimmed = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === n ? 0 : n)}
          className="text-xl leading-none transition-transform hover:scale-110 focus:outline-none"
          title={`${n} 顆星`}
        >
          <span className={
            (hover ? n <= hover : n <= value)
              ? (dimmed ? 'text-amber-200' : 'text-amber-400')
              : 'text-gray-200'
          }>
            ★
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 單題解析卡 ────────────────────────────────────────────────────────────────
function QuestionResult({ q, userAns, no, annotation, onSaveAnnotation }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState(annotation?.note ?? '')
  const [stars, setStars] = useState(annotation?.stars ?? 0)  // 0 = 尚未手動設定
  const [bookmarked, setBookmarked] = useState(annotation?.bookmarked ?? false)
  const [fuzzy, setFuzzy] = useState(annotation?.fuzzy ?? false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)

  // annotation 從父層非同步載入，載完後同步到本地 state
  useEffect(() => {
    if (annotation) {
      setNote(annotation.note ?? '')
      setStars(annotation.stars ?? 0)
      setBookmarked(annotation.bookmarked ?? false)
      setFuzzy(annotation.fuzzy ?? false)
    }
  }, [annotation])

  const correct = q.answer
  const isRight = userAns === correct
  const opts = ['A', 'B', 'C', 'D']

  // 自動星號（依 sources 數量）；手動星號優先
  const qAutoStars = autoStars(q)
  const isManual = stars > 0
  const displayStars = isManual ? stars : qAutoStars  // 顯示用

  const saveNote = useCallback((newNote, newStars) => {
    if (!onSaveAnnotation) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await onSaveAnnotation(q.id, { note: newNote, stars: newStars })
      setSaving(false)
    }, 800)
  }, [onSaveAnnotation, q.id])

  function handleNoteChange(e) {
    const v = e.target.value
    setNote(v)
    saveNote(v, stars)
  }

  function handleStarsChange(v) {
    setStars(v)
    if (!onSaveAnnotation) return
    clearTimeout(debounceRef.current)
    onSaveAnnotation(q.id, { note, stars: v })
  }

  function handleResetStars() {
    setStars(0)
    if (!onSaveAnnotation) return
    onSaveAnnotation(q.id, { note, stars: 0 })
  }

  function handleToggleBookmarked() {
    const next = !bookmarked
    setBookmarked(next)
    if (onSaveAnnotation) onSaveAnnotation(q.id, { bookmarked: next })
  }

  function handleToggleFuzzy() {
    const next = !fuzzy
    setFuzzy(next)
    if (onSaveAnnotation) onSaveAnnotation(q.id, { fuzzy: next })
  }

  return (
    <div className={`bg-white rounded-2xl shadow mb-3 overflow-hidden border-l-4
      ${isRight ? 'border-green-400' : userAns ? 'border-red-400' : 'border-gray-300'}`}>
      {/* 題目列 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-3"
      >
        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold mt-0.5
          ${isRight ? 'bg-green-100 text-green-700' :
            userAns ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-500'}`}>
          {isRight ? '✓' : userAns ? '✗' : '—'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400 mb-0.5 flex items-center gap-2 flex-wrap">
            <span>第 {no} 題{q.sources?.length > 0 && `・${q.sources[0]}`}</span>
            {displayStars > 0 && (
              <span className={isManual ? 'text-amber-400 text-xs' : 'text-amber-200 text-xs'}>
                {'★'.repeat(displayStars)}
              </span>
            )}
            {bookmarked && (
              <span className="bg-yellow-400 text-white text-xs font-bold px-1.5 py-0.5 rounded">★ 收藏</span>
            )}
            {fuzzy && (
              <span className="bg-purple-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">? 模糊</span>
            )}
          </div>
          <p className="text-sm text-gray-800 leading-relaxed line-clamp-2">
            {q.question_zh || q.question_en || '（無題目文字）'}
          </p>
          {note && !open && (
            <p className="text-xs text-blue-500 mt-1 truncate">📝 {note}</p>
          )}
        </div>
        <span className="text-gray-400 text-xs shrink-0 mt-1">{open ? '▲' : '▼'}</span>
      </button>

      {/* 展開解析 */}
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100">
          {/* 英文題目 */}
          {q.question_en && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed mt-3">
              {q.question_en}
            </div>
          )}

          {/* 選項 */}
          <div className="space-y-1.5">
            {opts.map(opt => {
              const isCorrect = opt === correct
              const isUser = opt === userAns
              return (
                <div key={opt}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm border
                    ${isCorrect ? 'border-green-400 bg-green-50 text-green-800 font-semibold' :
                      isUser && !isCorrect ? 'border-red-300 bg-red-50 text-red-700' :
                      'border-gray-100 text-gray-600'}`}>
                  <span className="font-bold shrink-0">{opt}.</span>
                  <span className="flex-1">{optionText(q, opt)}</span>
                  {isCorrect && <span className="shrink-0">✓ 正確答案</span>}
                  {isUser && !isCorrect && <span className="shrink-0">← 你的答案</span>}
                </div>
              )
            })}
          </div>

          {/* 解說 */}
          {q.explanations && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500">選項解說</div>
              {opts.map(opt => q.explanations[opt] && (
                <div key={opt} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="font-bold shrink-0">{opt}.</span>
                  <span>{q.explanations[opt]}</span>
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

          {/* ── 學生標註區 ── */}
          {onSaveAnnotation && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {/* 收藏 / 模糊標記 */}
              <div className="flex gap-2">
                <button
                  onClick={handleToggleBookmarked}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition
                    ${bookmarked
                      ? 'bg-yellow-400 border-yellow-400 text-white shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-yellow-500'}`}
                >
                  ★ 收藏
                </button>
                <button
                  onClick={handleToggleFuzzy}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition
                    ${fuzzy
                      ? 'bg-purple-500 border-purple-500 text-white shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-500'}`}
                >
                  ? 模糊
                </button>
              </div>

              {/* 重要性星號 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">重要程度</span>
                  {/* 自動星號提示 */}
                  {qAutoStars > 0 && (
                    <span className="text-xs text-gray-400">
                      考古題出現 {(q.sources ?? []).length} 次 →
                      <span className="text-amber-300 ml-1">{'★'.repeat(qAutoStars)}</span>
                      <span className="ml-1 text-gray-300">（自動）</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StarPicker
                    value={isManual ? stars : qAutoStars}
                    onChange={handleStarsChange}
                    dimmed={!isManual}
                  />
                  {isManual ? (
                    <span className="text-xs text-amber-500">自訂
                      <button onClick={handleResetStars}
                        className="ml-1.5 text-gray-400 hover:text-gray-600 underline">重設</button>
                    </span>
                  ) : qAutoStars > 0 ? (
                    <span className="text-xs text-gray-400">自動（點星號可覆蓋）</span>
                  ) : null}
                </div>
              </div>

              {/* 備註欄 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">我的備註</span>
                  {saving && <span className="text-xs text-gray-300">儲存中…</span>}
                  {!saving && note && <span className="text-xs text-green-400">✓ 已儲存</span>}
                </div>
                <textarea
                  value={note}
                  onChange={handleNoteChange}
                  placeholder="輸入重點筆記…（自動儲存）"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-y focus:ring-2 focus:ring-primary outline-none placeholder-gray-300"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function ResultPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [filter, setFilter] = useState('all') // all | wrong | unanswered
  const [annotations, setAnnotations] = useState({}) // { [questionId]: { note, stars } }

  const raw = sessionStorage.getItem('exam_result')
  const { questions, answers } = useMemo(() => {
    if (!raw) return { questions: [], answers: {} }
    try { return JSON.parse(raw) } catch { return { questions: [], answers: {} } }
  }, [raw])

  // 登入後批次載入所有題目的備註與星號
  useEffect(() => {
    if (!user || questions.length === 0) return
    getQuestionAnnotations(user.uid, questions.map(q => q.id))
      .then(data => setAnnotations(data))
      .catch(() => {})
  }, [user, questions])

  const handleSaveAnnotation = useCallback(async (questionId, data) => {
    if (!user) return
    await saveQuestionAnnotation(user.uid, questionId, data)
    setAnnotations(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...data },
    }))
  }, [user])

  if (!raw || questions.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-gray-500 mb-4">找不到測驗紀錄，請先完成測驗。</p>
        <button onClick={() => navigate('/')} className="bg-primary text-white px-6 py-2 rounded-lg">
          回首頁
        </button>
      </div>
    )
  }

  const correctCount = questions.filter((q, i) => answers[i] === q.answer).length
  const wrongCount   = questions.filter((q, i) => answers[i] && answers[i] !== q.answer).length
  const skipCount    = questions.filter((_, i) => !answers[i]).length
  const score        = Math.round((correctCount / questions.length) * 100)

  const filtered = questions.map((q, i) => ({ q, i, ans: answers[i] })).filter(({ q, ans }) => {
    if (filter === 'wrong')      return ans && ans !== q.answer
    if (filter === 'unanswered') return !ans
    return true
  })

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="max-w-3xl mx-auto">
      {/* 成績摘要 */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h1 className="text-xl font-bold text-gray-700 mb-4">測驗結果</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <div className="text-center sm:min-w-[5rem]">
            <div className={`text-5xl font-black ${scoreColor}`}>{score}</div>
            <div className="text-xs text-gray-400 mt-1">分（滿分 100）</div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-xl py-3">
              <div className="text-2xl font-bold text-green-700">{correctCount}</div>
              <div className="text-xs text-green-600">答對</div>
            </div>
            <div className="bg-red-50 rounded-xl py-3">
              <div className="text-2xl font-bold text-red-600">{wrongCount}</div>
              <div className="text-xs text-red-500">答錯</div>
            </div>
            <div className="bg-gray-50 rounded-xl py-3">
              <div className="text-2xl font-bold text-gray-500">{skipCount}</div>
              <div className="text-xs text-gray-400">未作答</div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm"
          >
            回首頁
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-green-800 transition text-sm"
          >
            再測一次
          </button>
        </div>
      </div>

      {/* 篩選列 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all',        label: `全部（${questions.length}）` },
          { key: 'wrong',      label: `答錯（${wrongCount}）` },
          { key: 'unanswered', label: `未作答（${skipCount}）` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition
              ${filter === key ? 'bg-primary text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 題目解析列表 */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-10">沒有符合條件的題目</p>
      ) : (
        filtered.map(({ q, i, ans }) => (
          <QuestionResult
            key={i}
            q={q}
            userAns={ans}
            no={i + 1}
            annotation={annotations[q.id]}
            onSaveAnnotation={user ? handleSaveAnnotation : null}
          />
        ))
      )}

      {!user && (
        <p className="text-center text-xs text-gray-400 mt-4">
          登入後可儲存備註與星號標記
        </p>
      )}
    </div>
  )
}
