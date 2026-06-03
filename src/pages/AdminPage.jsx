import { useState, useRef, useEffect, useCallback } from 'react'
import { parseDocxQuestions } from '../utils/parseDocx'
import { importQuestions, getQuestionsByUnit, getAllQuestions, deleteQuestion, updateQuestion } from '../firebase/questions'
import { UNITS } from '../utils/units'

const STEP = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' }

export default function AdminPage() {
  const [tab, setTab] = useState('upload')

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧑‍🏫 老師後台</h1>
      <p className="text-gray-500 text-sm mb-4">題庫管理與查詢</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'upload', label: '📤 上傳題庫' },
          { key: 'browse', label: '🔍 題庫查詢' },
          { key: 'dupes',  label: '🔁 重複偵測' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadTab />}
      {tab === 'browse' && <BrowseTab />}
      {tab === 'dupes'  && <DupesTab />}
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
    setFileName(file.name); setError(''); setStep(STEP.PARSING)
    try {
      const buf = await file.arrayBuffer()
      const { questions: qs, warnings: ws } = await parseDocxQuestions(buf, selectedUnit)
      setQuestions(qs); setWarnings(ws); setPreviewIdx(0); setStep(STEP.PREVIEW)
    } catch (err) {
      setError(`解析失敗：${err.message}`); setStep(STEP.IDLE)
    }
  }

  async function handleImport() {
    setStep(STEP.IMPORTING)
    try {
      const result = await importQuestions(questions, 'teacher')
      setImportResult(result); setStep(STEP.DONE)
    } catch (err) {
      setError(`匯入失敗：${err.message}`); setStep(STEP.PREVIEW)
    }
  }

  function reset() {
    setStep(STEP.IDLE); setQuestions([]); setWarnings([]); setImportResult(null)
    setError(''); setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const needsReviewCount = questions.filter(q => q.needs_review).length
  const displayQuestions = showOnlyReview ? questions.filter(q => q.needs_review) : questions

  return (
    <div>
      <StepBar step={step} />
      {error && <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

      {step === STEP.IDLE && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-semibold mb-4 text-gray-700">① 選擇單元 + 上傳題庫檔案</h2>
          <label className="block text-sm font-medium text-gray-600 mb-1">題庫所屬單元</label>
          <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-5 text-sm focus:ring-2 focus:ring-primary outline-none">
            {UNITS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.title_zh}</option>)}
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
                <summary className="cursor-pointer font-medium">⚠️ {warnings.length} 個警告</summary>
                <ul className="mt-2 space-y-1 list-disc list-inside">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </details>
            )}
          </div>
          {questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">題目預覽</span>
                  {needsReviewCount > 0 && (
                    <button onClick={() => { setShowOnlyReview(v => !v); setPreviewIdx(0) }}
                      className={`text-xs px-2 py-1 rounded-full border transition ${showOnlyReview ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                      {showOnlyReview ? '▼ 只看需確認' : '篩選：只看需確認'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button onClick={() => setPreviewIdx(i => Math.max(0, i - 1))} disabled={previewIdx === 0} className="px-2 py-1 rounded border disabled:opacity-40">◀</button>
                  <span className="text-gray-500">{previewIdx + 1} / {displayQuestions.length}</span>
                  <button onClick={() => setPreviewIdx(i => Math.min(displayQuestions.length - 1, i + 1))} disabled={previewIdx === displayQuestions.length - 1} className="px-2 py-1 rounded border disabled:opacity-40">▶</button>
                </div>
              </div>
              <QuestionDetail q={displayQuestions[previewIdx]} />
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">重新上傳</button>
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
          <p className="text-gray-600 font-medium">正在寫入 Firebase… 共 {questions.length} 題</p>
        </div>
      )}

      {step === STEP.DONE && importResult && (
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-700 mb-2">匯入完成！</h2>
          <p className="text-gray-500 mb-1">成功寫入 <strong>{importResult.success}</strong> 題</p>
          {importResult.failed > 0 && <p className="text-red-500 text-sm mb-1">失敗 {importResult.failed} 題</p>}
          <p className="text-gray-400 text-xs mb-6">已存在的題目將自動更新（不影響學生作答紀錄）</p>
          <button onClick={reset} className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-green-800 transition">繼續上傳其他單元</button>
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
  const [questions, setQuestions]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [unitCounts, setUnitCounts]     = useState({})
  const [expandedId, setExpandedId]     = useState(null)
  const [editingQ, setEditingQ]         = useState(null)
  const [filterReview, setFilterReview] = useState(false)
  const [search, setSearch]             = useState('')

  const loadUnit = useCallback(async (unitId) => {
    setLoading(true); setExpandedId(null); setSearch(''); setFilterReview(false)
    try {
      const qs = await getQuestionsByUnit(unitId)
      setQuestions(qs)
      setUnitCounts(prev => ({ ...prev, [unitId]: qs.length }))
    } finally {
      setLoading(false)
    }
  }, [])

  // 載入各單元題數概覽
  useEffect(() => {
    async function fetchCounts() {
      const counts = {}
      await Promise.all(UNITS.map(async u => {
        const qs = await getQuestionsByUnit(u.id)
        counts[u.id] = qs.length
      }))
      setUnitCounts(counts)
    }
    fetchCounts()
  }, [])

  useEffect(() => { loadUnit(selectedUnit) }, [selectedUnit, loadUnit])

  async function handleDelete(q) {
    if (!window.confirm(`確定要刪除「題目 ${q.question_no}」？此操作無法復原。`)) return
    await deleteQuestion(q.id)
    setQuestions(prev => prev.filter(x => x.id !== q.id))
    setUnitCounts(prev => ({ ...prev, [selectedUnit]: (prev[selectedUnit] ?? 1) - 1 }))
  }

  function handleEditSaved(updated) {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))
    setEditingQ(null)
  }

  const filtered = questions
    .filter(q => !filterReview || q.needs_review)
    .filter(q => {
      if (!search) return true
      const s = search.toLowerCase()
      return (q.question_en || '').toLowerCase().includes(s) ||
             (q.question_zh || '').toLowerCase().includes(s) ||
             (q.sources || []).join('').toLowerCase().includes(s)
    })

  const needsReviewCount = questions.filter(q => q.needs_review).length
  const totalCount = Object.values(unitCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      {/* 各單元題數總覽 */}
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
              <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition ${
                  isSelected ? 'border-primary bg-green-50 text-primary font-semibold' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
                }`}>
                <div className="font-medium">{u.name}</div>
                <div className="text-gray-500 truncate">{u.title_zh}</div>
                <div className={`mt-1 font-bold text-base ${isSelected ? 'text-primary' : 'text-gray-700'}`}>{count} 題</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 題目清單 */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-700">{UNITS.find(u => u.id === selectedUnit)?.name} 題目清單</h2>
            <span className="text-xs text-gray-400">{questions.length} 題</span>
            {needsReviewCount > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠️ {needsReviewCount} 需確認</span>
            )}
          </div>
          <button onClick={() => loadUnit(selectedUnit)} className="text-xs px-2 py-1 border rounded text-gray-500 hover:bg-gray-50">↻ 重新整理</button>
        </div>

        <div className="flex gap-2 mb-3">
          <input type="text" placeholder="搜尋題目文字或來源…" value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none" />
          {needsReviewCount > 0 && (
            <button onClick={() => setFilterReview(v => !v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition whitespace-nowrap ${filterReview ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
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
              <QuestionRow key={q.id} q={q}
                expanded={expandedId === q.id}
                onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                onEdit={() => setEditingQ(q)}
                onDelete={() => handleDelete(q)}
              />
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="mt-3 text-xs text-gray-400 text-right">顯示 {filtered.length} / {questions.length} 題</div>
        )}
      </div>

      {/* 編輯 Modal */}
      {editingQ && (
        <EditModal q={editingQ} onClose={() => setEditingQ(null)} onSaved={handleEditSaved} />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 3：重複偵測
// ══════════════════════════════════════════════════════════════════════════════

function DupesTab() {
  const [allQ, setAllQ]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [groups, setGroups]       = useState([])
  const [deletingId, setDeletingId] = useState(null)

  async function scan() {
    setLoading(true)
    try {
      const qs = await getAllQuestions()
      setAllQ(qs)
      // 用正規化後的英文題目文字分組（去空白大小寫）
      const map = {}
      for (const q of qs) {
        const key = (q.question_en || q.question_zh || '').toLowerCase().replace(/\s+/g, ' ').trim()
        if (!key) continue
        if (!map[key]) map[key] = []
        map[key].push(q)
      }
      const dupes = Object.values(map).filter(g => g.length > 1)
      setGroups(dupes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  async function handleDelete(q) {
    if (!window.confirm(`確定要刪除「${q.unit} 題目 ${q.question_no}」？此操作無法復原。`)) return
    setDeletingId(q.id)
    try {
      await deleteQuestion(q.id)
      const newAllQ = allQ.filter(x => x.id !== q.id)
      setAllQ(newAllQ)
      setGroups(prev => prev
        .map(g => g.filter(x => x.id !== q.id))
        .filter(g => g.length > 1)
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-700">重複題目偵測</h2>
          <button onClick={scan} disabled={loading}
            className="text-xs px-3 py-1.5 border rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40">
            {loading ? '掃描中…' : '↻ 重新掃描'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">比對所有題目的英文題目文字，找出內容相同但分屬不同單元或重複匯入的題目。</p>

        {loading ? (
          <div className="text-center py-10 text-gray-400">掃描中…</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-10 text-green-600">
            <div className="text-3xl mb-2">✅</div>
            <p>未發現重複題目（共掃描 {allQ.length} 題）</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
              ⚠️ 發現 <strong>{groups.length}</strong> 組重複題目，共 <strong>{groups.reduce((a, g) => a + g.length, 0)}</strong> 題
            </p>
            {groups.map((group, gi) => (
              <div key={gi} className="border border-yellow-200 rounded-xl overflow-hidden">
                <div className="bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800">
                  第 {gi + 1} 組（{group.length} 筆重複）
                </div>
                <div className="divide-y divide-gray-100">
                  {group.map(q => (
                    <div key={q.id} className="flex items-start gap-3 px-3 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-gray-700">{q.unit} — 題目 {q.question_no}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${q.needs_review ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {q.needs_review ? '⚠️ 需確認' : '✓ 正常'}
                          </span>
                          {q.answer && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">答案 {q.answer}</span>}
                          {q.sources?.length > 0 && <span className="text-xs text-gray-400">{q.sources[0]}</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{(q.question_zh || q.question_en || '').slice(0, 80)}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(q)}
                        disabled={deletingId === q.id}
                        className="shrink-0 text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition">
                        {deletingId === q.id ? '刪除中…' : '刪除'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 編輯 Modal
// ══════════════════════════════════════════════════════════════════════════════

function EditModal({ q, onClose, onSaved }) {
  const [form, setForm] = useState({
    unit:        q.unit        || 'unit1',
    answer:      q.answer      || '',
    question_en: q.question_en || '',
    question_zh: q.question_zh || '',
    optA_en: q.options?.A?.en || '', optA_zh: q.options?.A?.zh || '',
    optB_en: q.options?.B?.en || '', optB_zh: q.options?.B?.zh || '',
    optC_en: q.options?.C?.en || '', optC_zh: q.options?.C?.zh || '',
    optD_en: q.options?.D?.en || '', optD_zh: q.options?.D?.zh || '',
    optE_en: q.options?.E?.en || '', optE_zh: q.options?.E?.zh || '',
    needs_review: q.needs_review ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSave() {
    if (!form.answer) { setError('請填寫正確答案'); return }
    setSaving(true); setError('')
    try {
      const fields = {
        unit:        form.unit,
        answer:      form.answer.toUpperCase(),
        question_en: form.question_en || null,
        question_zh: form.question_zh || null,
        options: {
          A: { en: form.optA_en || null, zh: form.optA_zh || null },
          B: { en: form.optB_en || null, zh: form.optB_zh || null },
          C: { en: form.optC_en || null, zh: form.optC_zh || null },
          D: { en: form.optD_en || null, zh: form.optD_zh || null },
          E: { en: form.optE_en || null, zh: form.optE_zh || null },
        },
        needs_review: form.needs_review,
      }
      await updateQuestion(q.id, fields)
      onSaved({ ...q, ...fields })
    } catch (e) {
      setError(`儲存失敗：${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-800">編輯題目 #{q.question_no}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          {error && <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>}

          {/* 單元 + 答案 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">所屬單元</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary outline-none">
                {UNITS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.title_zh}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">正確答案 *</label>
              <select value={form.answer} onChange={e => set('answer', e.target.value)}
                className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary outline-none">
                <option value="">— 未設定 —</option>
                {['A','B','C','D','E'].map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          {/* 英文題目 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">英文題目</label>
            <textarea value={form.question_en} onChange={e => set('question_en', e.target.value)} rows={2}
              className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
          </div>

          {/* 中文題目 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">中文題目</label>
            <textarea value={form.question_zh} onChange={e => set('question_zh', e.target.value)} rows={2}
              className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
          </div>

          {/* 選項 A~E */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">選項（英文 / 中文）</label>
            <div className="space-y-2">
              {['A','B','C','D','E'].map(k => (
                <div key={k} className={`flex gap-2 items-start p-2 rounded-lg ${form.answer === k ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                  <span className="font-bold text-gray-600 mt-2 w-4 shrink-0">{k}</span>
                  <input value={form[`opt${k}_en`]} onChange={e => set(`opt${k}_en`, e.target.value)} placeholder="英文"
                    className="flex-1 border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
                  <input value={form[`opt${k}_zh`]} onChange={e => set(`opt${k}_zh`, e.target.value)} placeholder="中文"
                    className="flex-1 border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
                </div>
              ))}
            </div>
          </div>

          {/* 需確認旗標 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.needs_review} onChange={e => set('needs_review', e.target.checked)}
              className="rounded" />
            <span className="text-xs text-gray-600">標記為「需人工確認」</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">取消</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary text-white font-medium hover:bg-green-800 disabled:opacity-40 transition">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 共用子元件
// ══════════════════════════════════════════════════════════════════════════════

function QuestionRow({ q, expanded, onToggle, onEdit, onDelete }) {
  const preview = (q.question_zh || q.question_en || '').slice(0, 60)
  return (
    <div className={`border rounded-xl overflow-hidden transition ${q.needs_review ? 'border-yellow-200' : 'border-gray-100'}`}>
      <div className={`flex items-center gap-2 px-3 py-2 text-sm ${q.needs_review ? 'bg-yellow-50' : 'bg-white'}`}>
        {/* 展開按鈕區（主要點擊區） */}
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80">
          <span className="text-gray-400 text-xs w-10 shrink-0">#{q.question_no}</span>
          {q.needs_review
            ? <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded shrink-0">⚠️</span>
            : <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">✓</span>
          }
          <span className="flex-1 text-gray-700 truncate">{preview || '（無題目文字）'}</span>
          <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded ${q.answer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
            {q.answer || '?'}
          </span>
          {q.sources?.length > 0 && (
            <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
              {q.sources[0]}{q.sources.length > 1 ? ` +${q.sources.length - 1}` : ''}
            </span>
          )}
          <span className="text-gray-300 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
        </button>
        {/* 操作按鈕 */}
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit}
            className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-500 hover:bg-blue-50 transition">
            編輯
          </button>
          <button onClick={onDelete}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-400 hover:bg-red-50 transition">
            刪除
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <QuestionDetail q={q} />
        </div>
      )}
    </div>
  )
}

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
            ${i < currentIdx ? 'bg-green-100 text-green-700' : i === currentIdx ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
            {s.label}
          </div>
          {i < steps.length - 1 && <span className="text-gray-300 text-xs">›</span>}
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = { green: 'bg-green-50 text-green-700 border-green-200', yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200', red: 'bg-red-50 text-red-700 border-red-200' }
  return (
    <div className={`border rounded-xl py-3 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-0.5">{label}</div>
    </div>
  )
}

function QuestionDetail({ q }) {
  if (!q) return null
  const missing = []
  if (!q.question_en && !q.question_zh) missing.push('題目文字')
  if (!q.answer) missing.push('正確答案')
  const activeOpts = ['A','B','C','D','E'].filter(k => q.options?.[k]?.en || q.options?.[k]?.zh)
  if (activeOpts.length < 4) missing.push('選項不足 4 個')

  return (
    <div className="text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-gray-800">題目 {q.question_no}</span>
        {q.needs_review
          ? <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠️ 需確認</span>
          : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ 解析正常</span>
        }
        {q.sources?.length > 0 && <span className="text-xs text-gray-400">來源：{q.sources.join('、')}</span>}
        {q.page_ref && <span className="text-xs text-gray-400">{q.page_ref}</span>}
      </div>
      {missing.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 text-xs text-yellow-800">
          <span className="font-semibold">缺失欄位：</span>{missing.join('　|　')}
          {!q.answer && q._answerRaw && <div className="text-gray-500 mt-1">答案行原文：<code className="bg-white px-1 rounded">{q._answerRaw}</code></div>}
        </div>
      )}
      {q.question_en && <div className="bg-blue-50 rounded-lg px-3 py-2 text-gray-700 leading-relaxed">{q.question_en}</div>}
      {q.question_zh && <div className="bg-gray-50 rounded-lg px-3 py-2 text-gray-600 leading-relaxed">{q.question_zh}</div>}
      <div className="grid grid-cols-1 gap-1.5">
        {['A','B','C','D','E'].filter(opt => q.options?.[opt]?.en || q.options?.[opt]?.zh).map(opt => (
          <div key={opt} className={`flex gap-2 px-3 py-1.5 rounded-lg border text-xs ${q.answer === opt ? 'border-green-400 bg-green-50 font-semibold text-green-800' : 'border-gray-200 text-gray-600'}`}>
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
