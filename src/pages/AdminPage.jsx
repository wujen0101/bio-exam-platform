import { useState, useRef, useEffect, useCallback } from 'react'
import { parseDocxQuestions } from '../utils/parseDocx'
import { importQuestions, getQuestionsByUnit } from '../firebase/questions'
import { UNITS } from '../utils/units'

const STEP = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' }

export default function AdminPage() {
  const [tab, setTab] = useState('upload')  // 'upload' | 'browse'

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧑‍🏫 老師後台</h1>
      <p className="text-gray-500 text-sm mb-4">題庫管理與查詢</p>

      {/* ── Tab 切換 ── */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'upload', label: '📤 上傳題庫' },
          { key: 'browse', label: '🔍 題庫查詢' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadTab />}
      {tab === 'browse' && <BrowseTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1：上傳題庫
// ══════════════════════════════════════════════════════════════════════════════

function UploadTab() {
  const [step, setStep]           = useState(STEP.IDLE)
  const [selectedUnit, setSelectedUnit] = useState('unit1')
  const [fileName, setFileName]   = useState('')
  const [questions, setQuestions] = useState([])
  const [warnings, setWarnings]   = useState([])
  const [importResult, setImportResult] = useState(null)
  const [error, setError]         = useState('')
  const [previewIdx, setPreviewIdx] = useState(0)
  const [showOnlyReview, setShowOnlyReview] = useState(false)
  const fileRef = useRef()

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) { setError('請上傳 .docx 格式的題庫檔案'); return }
    setFileName(file.name)
    setError('')
    setStep(STEP.PARSING)
    try {
      const buf = await file.arrayBuffer()
      const { questions: qs, warnings: ws } = await parseDocxQuestions(buf, selectedUnit)
      setQuestions(qs)
      setWarnings(ws)
      setPreviewIdx(0)
      setStep(STEP.PREVIEW)
    } catch (err) {
      setError(`解析失敗：${err.message}`)
      setStep(STEP.IDLE)
    }
  }

  async function handleImport() {
    setStep(STEP.IMPORTING)
    try {
      const result = await importQuestions(questions, 'teacher')
      setImportResult(result)
      setStep(STEP.DONE)
    } catch (err) {
      setError(`匯入失敗：${err.message}`)
      setStep(STEP.PREVIEW)
    }
  }

  function reset() {
    setStep(STEP.IDLE)
    setQuestions([])
    setWarnings([])
    setImportResult(null)
    setError('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const needsReviewCount = questions.filter(q => q.needs_review).length
  const displayQuestions = showOnlyReview ? questions.filter(q => q.needs_review) : questions

  return (
    <div>
      <StepBar step={step} />

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {step === STEP.IDLE && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-4 text-gray-700">① 選擇單元 + 上傳題庫檔案</h2>
          <label className="block text-sm font-medium text-gray-600 mb-1">題庫所屬單元</label>
          <select
            value={selectedUnit}
            onChange={e => setSelectedUnit(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-5 text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            {UNITS.map(u => (
              <option key={u.id} value={u.id}>{u.name} — {u.title_zh}</option>
            ))}
          </select>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-primary hover:bg-green-50 transition">
            <span className="text-4xl mb-2">📄</span>
            <span className="font-medium text-gray-700">點擊或拖曳 .docx 題庫檔案至此</span>
            <span className="text-xs text-gray-400 mt-1">檔案格式：Unit1_解析報告.docx（含題目解析）</span>
            <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
          </label>
        </div>
      )}

      {step === STEP.PARSING && (
        <div className="bg-white rounded-2xl shadow p-10 flex flex-col items-center gap-3">
          <div className="animate-spin text-4xl">⚙️</div>
          <p className="text-gray-600 font-medium">正在解析 {fileName}…</p>
          <p className="text-gray-400 text-sm">依檔案大小約需 1–5 秒</p>
        </div>
      )}

      {step === STEP.PREVIEW && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-semibold text-gray-700 mb-3">② 解析結果預覽</h2>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              <StatCard label="解析題數" value={questions.length} color="green" />
              <StatCard label="需人工確認" value={needsReviewCount} color={needsReviewCount > 0 ? 'yellow' : 'green'} />
              <StatCard label="警告訊息" value={warnings.length} color={warnings.length > 0 ? 'red' : 'green'} />
            </div>
            {warnings.length > 0 && (
              <details className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-3">
                <summary className="cursor-pointer font-medium">⚠️ {warnings.length} 個警告（點擊展開）</summary>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>

          {questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">題目預覽</span>
                  {needsReviewCount > 0 && (
                    <button
                      onClick={() => { setShowOnlyReview(v => !v); setPreviewIdx(0) }}
                      className={`text-xs px-2 py-1 rounded-full border transition ${
                        showOnlyReview
                          ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-yellow-50'
                      }`}
                    >
                      {showOnlyReview ? '▼ 只看需確認' : '篩選：只看需確認'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}
                    disabled={previewIdx === 0} className="px-2 py-1 rounded border disabled:opacity-40">◀</button>
                  <span className="text-gray-500">{previewIdx + 1} / {displayQuestions.length}</span>
                  <button onClick={() => setPreviewIdx(i => Math.min(displayQuestions.length - 1, i + 1))}
                    disabled={previewIdx === displayQuestions.length - 1} className="px-2 py-1 rounded border disabled:opacity-40">▶</button>
                </div>
              </div>
              <QuestionPreview q={displayQuestions[previewIdx]} />
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
              重新上傳
            </button>
            <button onClick={handleImport} disabled={questions.length === 0}
              className="flex-1 py-2 rounded-lg bg-primary text-white font-medium hover:bg-green-800 disabled:opacity-40 transition">
              確認匯入 {questions.length} 題 → Firebase
            </button>
          </div>
        </div>
      )}

      {step === STEP.IMPORTING && (
        <div className="bg-white rounded-2xl shadow p-10 flex flex-col items-center gap-3">
          <div className="animate-spin text-4xl">🔥</div>
          <p className="text-gray-600 font-medium">正在寫入 Firebase…</p>
          <p className="text-gray-400 text-sm">共 {questions.length} 題，請勿關閉視窗</p>
        </div>
      )}

      {step === STEP.DONE && importResult && (
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-700 mb-2">匯入完成！</h2>
          <p className="text-gray-500 mb-1">成功寫入 <strong>{importResult.success}</strong> 題</p>
          {importResult.failed > 0 && <p className="text-red-500 text-sm mb-1">失敗 {importResult.failed} 題</p>}
          <p className="text-gray-400 text-xs mb-6">已存在的題目將自動更新（不影響學生作答紀錄）</p>
          <button onClick={reset} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-green-800 transition">
            繼續上傳其他單元
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 2：題庫查詢
// ══════════════════════════════════════════════════════════════════════════════

function BrowseTab() {
  const [selectedUnit, setSelectedUnit] = useState('unit1')
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [unitCounts, setUnitCounts] = useState({})  // { unitId: count }
  const [expandedId, setExpandedId] = useState(null)
  const [filterReview, setFilterReview] = useState(false)
  const [search, setSearch] = useState('')

  // 載入各單元題數概覽
  useEffect(() => {
    async function fetchCounts() {
      const counts = {}
      await Promise.all(
        UNITS.map(async u => {
          const qs = await getQuestionsByUnit(u.id)
          counts[u.id] = qs.length
        })
      )
      setUnitCounts(counts)
    }
    fetchCounts()
  }, [])

  // 載入選定單元的題目
  const loadUnit = useCallback(async (unitId) => {
    setLoading(true)
    setExpandedId(null)
    setSearch('')
    setFilterReview(false)
    try {
      const qs = await getQuestionsByUnit(unitId)
      setQuestions(qs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUnit(selectedUnit)
  }, [selectedUnit, loadUnit])

  const filtered = questions
    .filter(q => !filterReview || q.needs_review)
    .filter(q => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        (q.question_en || '').toLowerCase().includes(s) ||
        (q.question_zh || '').toLowerCase().includes(s) ||
        (q.sources || []).join('').toLowerCase().includes(s)
      )
    })

  const needsReviewCount = questions.filter(q => q.needs_review).length
  const totalCount = Object.values(unitCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      {/* ── 各單元題數總覽 ── */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">各單元題數總覽</h2>
          <span className="text-xs text-gray-400">全部題庫共 <strong className="text-gray-600">{totalCount}</strong> 題</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {UNITS.map(u => {
            const count = unitCounts[u.id] ?? '…'
            const isSelected = selectedUnit === u.id
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUnit(u.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition ${
                  isSelected
                    ? 'border-primary bg-green-50 text-primary font-semibold'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <div className="font-medium">{u.name}</div>
                <div className="text-gray-500 truncate">{u.title_zh}</div>
                <div className={`mt-1 font-bold text-base ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                  {count} 題
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 題目清單 ── */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-700">
              {UNITS.find(u => u.id === selectedUnit)?.name} 題目清單
            </h2>
            <span className="text-xs text-gray-400">{questions.length} 題</span>
            {needsReviewCount > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                ⚠️ {needsReviewCount} 題需確認
              </span>
            )}
          </div>
          <button onClick={() => loadUnit(selectedUnit)}
            className="text-xs px-2 py-1 border rounded text-gray-500 hover:bg-gray-50">
            ↻ 重新整理
          </button>
        </div>

        {/* 篩選列 */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="搜尋題目文字或來源…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none"
          />
          {needsReviewCount > 0 && (
            <button
              onClick={() => setFilterReview(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition whitespace-nowrap ${
                filterReview
                  ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {filterReview ? '▼ 只看需確認' : '只看需確認'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">載入中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {questions.length === 0 ? '此單元尚未匯入任何題目' : '沒有符合條件的題目'}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(q => (
              <QuestionRow
                key={q.id}
                q={q}
                expanded={expandedId === q.id}
                onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-3 text-xs text-gray-400 text-right">
            顯示 {filtered.length} / {questions.length} 題
          </div>
        )}
      </div>
    </div>
  )
}

function QuestionRow({ q, expanded, onToggle }) {
  const preview = (q.question_zh || q.question_en || '').slice(0, 60)
  return (
    <div className={`border rounded-xl overflow-hidden transition ${
      q.needs_review ? 'border-yellow-200' : 'border-gray-100'
    }`}>
      {/* 摘要列（點擊展開） */}
      <button
        onClick={onToggle}
        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition text-sm ${
          q.needs_review ? 'bg-yellow-50' : 'bg-white'
        }`}
      >
        <span className="text-gray-400 text-xs w-10 shrink-0">#{q.question_no}</span>

        {q.needs_review
          ? <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded shrink-0">⚠️ 需確認</span>
          : <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">✓</span>
        }

        <span className="flex-1 text-gray-700 truncate">{preview || '（無題目文字）'}</span>

        <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded ${
          q.answer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
        }`}>
          {q.answer || '?'}
        </span>

        {q.sources?.length > 0 && (
          <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
            {q.sources[0]}{q.sources.length > 1 ? ` +${q.sources.length - 1}` : ''}
          </span>
        )}

        <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* 展開詳情 */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <QuestionPreview q={q} />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 共用子元件
// ══════════════════════════════════════════════════════════════════════════════

function StepBar({ step }) {
  const steps = [
    { key: STEP.IDLE,      label: '① 選擇檔案' },
    { key: STEP.PARSING,   label: '② 解析中' },
    { key: STEP.PREVIEW,   label: '③ 確認預覽' },
    { key: STEP.IMPORTING, label: '④ 匯入中' },
    { key: STEP.DONE,      label: '✅ 完成' },
  ]
  const currentIdx = steps.findIndex(s => s.key === step)
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 flex-1">
          <div className={`text-xs px-2 py-1 rounded-full text-center flex-1 font-medium transition
            ${i < currentIdx ? 'bg-green-100 text-green-700' :
              i === currentIdx ? 'bg-primary text-white' :
              'bg-gray-100 text-gray-400'}`}>
            {s.label}
          </div>
          {i < steps.length - 1 && <span className="text-gray-300 text-xs">›</span>}
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    green:  'bg-green-50  text-green-700  border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red:    'bg-red-50    text-red-700    border-red-200',
  }
  return (
    <div className={`border rounded-xl py-3 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5">{label}</div>
    </div>
  )
}

function QuestionPreview({ q }) {
  if (!q) return null

  const missing = []
  if (!q.question_en && !q.question_zh) missing.push('題目文字（英文+中文均缺）')
  if (!q.answer) missing.push('正確答案')
  const activeOptKeys = ['A','B','C','D','E'].filter(k => q.options?.[k]?.en || q.options?.[k]?.zh)
  if (activeOptKeys.length < 4) missing.push('（不足 4 個選項）')

  const reviewBadge = q.needs_review
    ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠️ 需確認</span>
    : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 解析正常</span>

  return (
    <div className="text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-gray-800">題目 {q.question_no}</span>
        {reviewBadge}
        {q.sources?.length > 0 && <span className="text-xs text-gray-400">來源：{q.sources.join('、')}</span>}
        {q.page_ref && <span className="text-xs text-gray-400">{q.page_ref}</span>}
      </div>

      {missing.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 text-xs text-yellow-800 space-y-1">
          <div><span className="font-semibold">缺失欄位：</span>{missing.join('　|　')}</div>
          {!q.answer && q._answerRaw && (
            <div className="text-gray-500">答案行原文：<code className="bg-white px-1 rounded">{q._answerRaw}</code></div>
          )}
        </div>
      )}

      {q.question_en && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 text-gray-700 leading-relaxed">{q.question_en}</div>
      )}
      {q.question_zh && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-gray-600 leading-relaxed">{q.question_zh}</div>
      )}

      <div className="grid grid-cols-1 gap-1.5">
        {['A','B','C','D','E'].filter(opt => q.options?.[opt]?.en || q.options?.[opt]?.zh).map(opt => (
          <div key={opt}
            className={`flex gap-2 px-3 py-1.5 rounded-lg border text-xs ${
              q.answer === opt
                ? 'border-green-400 bg-green-50 font-semibold text-green-800'
                : 'border-gray-200 text-gray-600'
            }`}>
            <span className="font-bold">{opt}.</span>
            <span>{q.options?.[opt]?.en || q.options?.[opt]?.zh || '—'}</span>
            {q.answer === opt && <span className="ml-auto">✓</span>}
          </div>
        ))}
      </div>

      {q.memory_tips && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          🧠 {q.memory_tips.slice(0, 150)}{q.memory_tips.length > 150 ? '…' : ''}
        </div>
      )}
    </div>
  )
}
