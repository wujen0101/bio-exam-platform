import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { drawQuestions } from '../firebase/questions'
import { saveExamRecord } from '../firebase/records'
import { useAuth } from '../context/AuthContext'
import { UNITS, SCHOOL_RATIOS } from '../utils/units'

const DEFAULT_COUNT = 20

// ── 模擬考設定面板 ────────────────────────────────────────────────────────────
function MockSetup({ onStart }) {
  const [school, setSchool] = useState('綜合平均')
  const [count, setCount] = useState(50)

  const schools = Object.keys(SCHOOL_RATIOS)

  function handleStart() {
    const rawRatios = SCHOOL_RATIOS[school]
    const total = Object.values(rawRatios).reduce((a, b) => a + b, 0)
    const ratios = Object.fromEntries(
      Object.entries(rawRatios).map(([k, v]) => [k, v / total])
    )
    onStart({ unitIds: Object.keys(rawRatios), count, ratios })
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 mt-6">
      <h2 className="text-lg font-bold mb-4 text-secondary">🎯 模擬考設定</h2>

      <label className="block text-sm font-medium text-gray-600 mb-1">目標學校出題比率</label>
      <select
        value={school}
        onChange={e => setSchool(e.target.value)}
        className="border rounded-lg px-3 py-2 w-full mb-5 text-sm focus:ring-2 focus:ring-secondary outline-none"
      >
        {schools.map(s => <option key={s}>{s}</option>)}
      </select>

      <label className="block text-sm font-medium text-gray-600 mb-1">
        題數：<span className="text-secondary font-bold">{count}</span> 題
      </label>
      <input
        type="range" min={10} max={100} step={5} value={count}
        onChange={e => setCount(Number(e.target.value))}
        className="w-full mb-5 accent-secondary"
      />

      <button
        onClick={handleStart}
        className="w-full bg-secondary text-white py-2.5 rounded-lg font-medium hover:bg-blue-900 transition"
      >
        開始模擬考（{count} 題）
      </button>
    </div>
  )
}

// ── 單元測驗設定面板 ──────────────────────────────────────────────────────────
function UnitSetup({ preSelected, onStart }) {
  const [selected, setSelected] = useState(preSelected || [])
  const [count, setCount] = useState(DEFAULT_COUNT)

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleStart() {
    if (selected.length === 0) return
    onStart({ unitIds: selected, count, ratios: null })
  }

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <h2 className="text-lg font-bold mb-4 text-primary">📝 選擇單元</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
        {UNITS.map(u => (
          <button
            key={u.id}
            onClick={() => toggle(u.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition
              ${selected.includes(u.id)
                ? 'border-primary bg-green-50'
                : 'border-gray-200 hover:border-gray-300'}`}
          >
            <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
              ${selected.includes(u.id) ? 'border-primary bg-primary' : 'border-gray-300'}`}>
              {selected.includes(u.id) && <span className="text-white text-xs">✓</span>}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800">{u.name} {u.title_zh}</div>
              <div className="text-xs text-gray-400">{u.chapters.length} 章・{Math.round(u.exam_ratio * 100)}%</div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow px-5 py-4 mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">
          題數：<span className="text-primary font-bold">{count}</span> 題
        </label>
        <input
          type="range" min={5} max={50} step={5} value={count}
          onChange={e => setCount(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <button
        onClick={handleStart}
        disabled={selected.length === 0}
        className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-green-800 disabled:opacity-40 transition"
      >
        {selected.length === 0 ? '請選擇至少一個單元' : `開始測驗（${count} 題）`}
      </button>
    </div>
  )
}

// ── 作答介面 ──────────────────────────────────────────────────────────────────
function QuestionCard({ question, index, total, answer, answers, onAnswer, onNavigate, onPrev, onNext, onSubmit, timer }) {
  const opts = ['A', 'B', 'C', 'D']
  const isLast = index === total - 1

  const optionText = (opt) => {
    const o = question.options?.[opt]
    if (!o) return '—'
    if (typeof o === 'string') return o
    return [o.en, o.zh].filter(Boolean).join('  ')
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 進度條 + 計時器 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-500 shrink-0">{index + 1} / {total}</span>
        {timer}
      </div>

      {/* 題目來源 */}
      {question.sources?.length > 0 && (
        <div className="text-xs text-gray-400 mb-2">
          來源：{question.sources.join('・')}
          {question.page_ref && `・${question.page_ref}`}
        </div>
      )}

      {/* 題目內容 */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <div className="font-bold text-gray-800 mb-1 text-sm">第 {index + 1} 題</div>
        {question.question_en && (
          <p className="text-gray-800 leading-relaxed mb-2">{question.question_en}</p>
        )}
        {question.question_zh && (
          <p className="text-gray-600 text-sm leading-relaxed">{question.question_zh}</p>
        )}
      </div>

      {/* 選項 */}
      <div className="space-y-2.5 mb-6">
        {opts.map(opt => (
          <button
            key={opt}
            onClick={() => onAnswer(opt)}
            className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition
              ${answer === opt
                ? 'border-primary bg-green-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5
              ${answer === opt ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
              {opt}
            </span>
            <span className="text-sm text-gray-700 leading-relaxed">{optionText(opt)}</span>
          </button>
        ))}
      </div>

      {/* 導覽按鈕 */}
      <div className="flex gap-3">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          ← 上一題
        </button>

        {isLast ? (
          <button
            onClick={onSubmit}
            className="flex-1 py-2 rounded-lg bg-accent text-white font-bold hover:bg-yellow-600 transition"
          >
            交卷
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex-1 py-2 rounded-lg bg-primary text-white font-medium hover:bg-green-800 transition"
          >
            下一題 →
          </button>
        )}
      </div>

      {/* 題目縮圖列 */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            className={`w-7 h-7 rounded text-xs font-medium transition
              ${i === index ? 'bg-primary text-white' :
                answers[i] !== undefined ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 計時器顯示元件 ────────────────────────────────────────────────────────────
function Timer({ secondsLeft }) {
  const m = Math.floor(secondsLeft / 60)
  const s = String(secondsLeft % 60).padStart(2, '0')
  const urgent = secondsLeft <= 300  // 最後 5 分鐘變紅
  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-3 py-1 rounded-lg
      ${urgent ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
      ⏱ {m}:{s}
    </div>
  )
}

// ── ExamRunner ────────────────────────────────────────────────────────────────
function ExamRunner({ questions, onDone, timeLimit }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [secondsLeft, setSecondsLeft] = useState(timeLimit ?? null)

  // 倒數計時
  useEffect(() => {
    if (secondsLeft === null) return
    if (secondsLeft <= 0) {
      onDone(answers)
      return
    }
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])  // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i) => setIndex(Math.max(0, Math.min(questions.length - 1, i)))

  function handleAnswer(opt) {
    setAnswers(prev => ({ ...prev, [index]: opt }))
  }

  function handleSubmit() {
    const unanswered = questions.length - Object.keys(answers).length
    if (unanswered > 0) {
      const confirmed = window.confirm(`還有 ${unanswered} 題未作答，確定要交卷嗎？`)
      if (!confirmed) return
    }
    onDone(answers)
  }

  return (
    <QuestionCard
      question={questions[index]}
      index={index}
      total={questions.length}
      answer={answers[index]}
      answers={answers}
      onAnswer={handleAnswer}
      onNavigate={goTo}
      onPrev={() => goTo(index - 1)}
      onNext={() => goTo(index + 1)}
      onSubmit={handleSubmit}
      timer={secondsLeft !== null ? <Timer secondsLeft={secondsLeft} /> : null}
    />
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function ExamPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const mode = searchParams.get('mode') || 'unit'
  const preUnits = searchParams.get('units')?.split(',').filter(Boolean) || []

  const [phase, setPhase] = useState('setup')  // setup | loading | exam
  const [questions, setQuestions] = useState([])
  const [error, setError] = useState('')

  // 如果 URL 直接帶了 units 參數（從首頁單元卡片點進來），直接開始
  useEffect(() => {
    if (mode === 'unit' && preUnits.length > 0) {
      loadAndStart({ unitIds: preUnits, count: DEFAULT_COUNT, ratios: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAndStart({ unitIds, count, ratios }) {
    setPhase('loading')
    setError('')
    try {
      let qs
      if (ratios) {
        qs = await drawQuestions(unitIds, count, ratios)
      } else {
        // 單元測驗：平均分配
        qs = await drawQuestions(unitIds, count, null)
      }
      if (qs.length === 0) {
        setError('尚未有題目，請老師先至後台匯入題庫。')
        setPhase('setup')
        return
      }
      setQuestions(qs)
      setPhase('exam')
    } catch (err) {
      setError(`載入失敗：${err.message}`)
      setPhase('setup')
    }
  }

  async function handleDone(answers) {
    sessionStorage.setItem('exam_result', JSON.stringify({ questions, answers }))
    // 登入中才寫紀錄，未登入直接跳轉（不擋匿名使用）
    if (user) {
      try {
        await saveExamRecord(user.uid, questions, answers)
      } catch (err) {
        console.error('寫入作答紀錄失敗：', err)
      }
    }
    navigate('/result')
  }

  // ── 渲染 ──
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="animate-spin text-4xl">🧬</div>
        <p className="text-gray-600 font-medium">正在抽題中…</p>
      </div>
    )
  }

  if (phase === 'exam') {
    // 模擬考：每題 2 分鐘計時
    const timeLimit = mode === 'mock' ? questions.length * 120 : null
    return <ExamRunner questions={questions} onDone={handleDone} timeLimit={timeLimit} />
  }

  // setup 階段
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-2">
        {mode === 'mock' ? '🎯 模擬考' : '📝 單元測驗'}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {mode === 'mock'
        ? <MockSetup onStart={loadAndStart} />
        : <UnitSetup preSelected={preUnits} onStart={loadAndStart} />
      }
    </div>
  )
}
