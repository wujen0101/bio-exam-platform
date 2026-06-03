import { useState, useRef } from 'react'
import { parseDocxQuestions } from '../utils/parseDocx'
import { importQuestions } from '../firebase/questions'
import { UNITS } from '../utils/units'

// ── 匯入步驟常數 ─────────────────────────────────────────────────────────────
const STEP = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' }

export default function AdminPage() {
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

  // ── 步驟 1：選檔解析 ────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) {
      setError('請上傳 .docx 格式的題庫檔案')
      return
    }

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

  // ── 步驟 2：確認匯入 ────────────────────────────────────────────────────────
  async function handleImport() {
    setStep(STEP.IMPORTING)
    try {
      // 目前無登入機制，uploadedBy 先用 'teacher'
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

  // ── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧑‍🏫 老師後台 — 題庫管理</h1>
      <p className="text-gray-500 text-sm mb-6">上傳 .docx 題庫解析報告，自動解析並匯入 Firebase</p>

      {/* ── 步驟指示器 ── */}
      <StepBar step={step} />

      {/* ── 錯誤提示 ── */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ══ IDLE：選單元 + 選檔 ══ */}
      {step === STEP.IDLE && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-4 text-gray-700">① 選擇單元 + 上傳題庫檔案</h2>

          {/* 選單元 */}
          <label className="block text-sm font-medium text-gray-600 mb-1">題庫所屬單元</label>
          <select
            value={selectedUnit}
            onChange={e => setSelectedUnit(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-5 text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            {UNITS.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.title_zh}
              </option>
            ))}
          </select>

          {/* 拖曳上傳區 */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-primary hover:bg-green-50 transition">
            <span className="text-4xl mb-2">📄</span>
            <span className="font-medium text-gray-700">點擊或拖曳 .docx 題庫檔案至此</span>
            <span className="text-xs text-gray-400 mt-1">檔案格式：Unit1_解析報告.docx（含題目解析）</span>
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      {/* ══ PARSING：解析中 ══ */}
      {step === STEP.PARSING && (
        <div className="bg-white rounded-2xl shadow p-10 flex flex-col items-center gap-3">
          <div className="animate-spin text-4xl">⚙️</div>
          <p className="text-gray-600 font-medium">正在解析 {fileName}…</p>
          <p className="text-gray-400 text-sm">依檔案大小約需 1–5 秒</p>
        </div>
      )}

      {/* ══ PREVIEW：預覽與確認 ══ */}
      {step === STEP.PREVIEW && (
        <div className="space-y-4">
          {/* 統計摘要 */}
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="font-semibold text-gray-700 mb-3">② 解析結果預覽</h2>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              <StatCard label="解析題數" value={questions.length} color="green" />
              <StatCard label="需人工確認" value={needsReviewCount} color={needsReviewCount > 0 ? 'yellow' : 'green'} />
              <StatCard label="警告訊息" value={warnings.length} color={warnings.length > 0 ? 'red' : 'green'} />
            </div>

            {/* 警告清單 */}
            {warnings.length > 0 && (
              <details className="text-xs text-yellow-700 bg-yellow-50 rounded-lg p-3">
                <summary className="cursor-pointer font-medium">⚠️ {warnings.length} 個警告（點擊展開）</summary>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </div>

          {/* 單題預覽 */}
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
                    disabled={previewIdx === 0}
                    className="px-2 py-1 rounded border disabled:opacity-40">◀</button>
                  <span className="text-gray-500">{previewIdx + 1} / {displayQuestions.length}</span>
                  <button onClick={() => setPreviewIdx(i => Math.min(displayQuestions.length - 1, i + 1))}
                    disabled={previewIdx === displayQuestions.length - 1}
                    className="px-2 py-1 rounded border disabled:opacity-40">▶</button>
                </div>
              </div>
              <QuestionPreview q={displayQuestions[previewIdx]} />
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="flex gap-3">
            <button onClick={reset}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
              重新上傳
            </button>
            <button onClick={handleImport}
              disabled={questions.length === 0}
              className="flex-1 py-2 rounded-lg bg-primary text-white font-medium hover:bg-green-800 disabled:opacity-40 transition">
              確認匯入 {questions.length} 題 → Firebase
            </button>
          </div>
        </div>
      )}

      {/* ══ IMPORTING：匯入中 ══ */}
      {step === STEP.IMPORTING && (
        <div className="bg-white rounded-2xl shadow p-10 flex flex-col items-center gap-3">
          <div className="animate-spin text-4xl">🔥</div>
          <p className="text-gray-600 font-medium">正在寫入 Firebase…</p>
          <p className="text-gray-400 text-sm">共 {questions.length} 題，請勿關閉視窗</p>
        </div>
      )}

      {/* ══ DONE：完成 ══ */}
      {step === STEP.DONE && importResult && (
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-700 mb-2">匯入完成！</h2>
          <p className="text-gray-500 mb-1">成功寫入 <strong>{importResult.success}</strong> 題</p>
          {importResult.failed > 0 && (
            <p className="text-red-500 text-sm mb-1">失敗 {importResult.failed} 題</p>
          )}
          <p className="text-gray-400 text-xs mb-6">已存在的題目將自動更新（不影響學生作答紀錄）</p>
          <button onClick={reset}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-green-800 transition">
            繼續上傳其他單元
          </button>
        </div>
      )}
    </div>
  )
}

// ── 子元件 ───────────────────────────────────────────────────────────────────

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
    <div className={`border rounded-xl py-3 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5">{label}</div>
    </div>
  )
}

function QuestionPreview({ q }) {
  if (!q) return null

  // 診斷缺失欄位
  const missing = []
  if (!q.question_en && !q.question_zh) missing.push('題目文字（英文+中文均缺）')
  if (!q.answer) missing.push('正確答案')
  const missingOpts = ['A','B','C','D'].filter(k => !q.options?.[k]?.en && !q.options?.[k]?.zh)
  if (missingOpts.length > 0) missing.push(`選項 ${missingOpts.join('、')} 缺失`)

  const reviewBadge = q.needs_review
    ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠️ 需確認</span>
    : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 解析正常</span>

  return (
    <div className="text-sm space-y-3">
      {/* 題目 header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-gray-800">題目 {q.question_no}</span>
        {reviewBadge}
        {q.sources?.length > 0 && (
          <span className="text-xs text-gray-400">來源：{q.sources.join('、')}</span>
        )}
        {q.page_ref && <span className="text-xs text-gray-400">{q.page_ref}</span>}
      </div>

      {/* 缺失欄位診斷 */}
      {missing.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 text-xs text-yellow-800">
          <span className="font-semibold">缺失欄位：</span>{missing.join('　|　')}
        </div>
      )}

      {/* 英文題目 */}
      {q.question_en && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 text-gray-700 leading-relaxed">
          {q.question_en}
        </div>
      )}

      {/* 中文題目 */}
      {q.question_zh && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-gray-600 leading-relaxed">
          {q.question_zh}
        </div>
      )}

      {/* 選項 */}
      <div className="grid grid-cols-1 gap-1.5">
        {['A','B','C','D'].map(opt => (
          <div key={opt}
            className={`flex gap-2 px-3 py-1.5 rounded-lg border text-xs
              ${q.answer === opt
                ? 'border-green-400 bg-green-50 font-semibold text-green-800'
                : 'border-gray-200 text-gray-600'}`}>
            <span className="font-bold">{opt}.</span>
            <span>{q.options?.[opt]?.en || q.options?.[opt]?.zh || '—'}</span>
            {q.answer === opt && <span className="ml-auto">✓</span>}
          </div>
        ))}
      </div>

      {/* 記憶口訣 */}
      {q.memory_tips && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          🧠 {q.memory_tips.slice(0, 120)}{q.memory_tips.length > 120 ? '…' : ''}
        </div>
      )}
    </div>
  )
}
