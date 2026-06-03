import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UNIT_MAP } from '../utils/units'

function optionText(question, opt) {
  const o = question.options?.[opt]
  if (!o) return '—'
  if (typeof o === 'string') return o
  return [o.en, o.zh].filter(Boolean).join('  ')
}

// ── 單題解析卡 ────────────────────────────────────────────────────────────────
function QuestionResult({ q, userAns, no }) {
  const [open, setOpen] = useState(false)
  const correct = q.answer
  const isRight = userAns === correct
  const opts = ['A', 'B', 'C', 'D']

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
          <div className="text-xs text-gray-400 mb-0.5">第 {no} 題{q.sources?.length > 0 && `・${q.sources[0]}`}</div>
          <p className="text-sm text-gray-800 leading-relaxed line-clamp-2">
            {q.question_zh || q.question_en || '（無題目文字）'}
          </p>
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
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function ResultPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all') // all | wrong | unanswered

  const raw = sessionStorage.getItem('exam_result')
  const { questions, answers } = useMemo(() => {
    if (!raw) return { questions: [], answers: {} }
    try { return JSON.parse(raw) } catch { return { questions: [], answers: {} } }
  }, [raw])

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
        <div className="flex items-center gap-6 mb-4">
          <div className="text-center">
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
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm"
          >
            回首頁
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-2 rounded-lg bg-primary text-white font-medium hover:bg-green-800 transition text-sm"
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
          <QuestionResult key={i} q={q} userAns={ans} no={i + 1} />
        ))
      )}
    </div>
  )
}
