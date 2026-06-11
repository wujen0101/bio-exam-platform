import { useState, useRef, useEffect, useCallback } from 'react'
import { parseDocxQuestions } from '../utils/parseDocx'
import { importQuestions, getQuestionsByUnit, getAllQuestions, deleteQuestion, updateQuestion, recalcAllAutoStars } from '../firebase/questions'
import { getAllUsers, getUserLoginHistory } from '../firebase/users'
import { UNITS, UNIT_MAP } from '../utils/units'

const STEP = { IDLE: 'idle', PARSING: 'parsing', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' }

export default function AdminPage() {
  const [tab, setTab] = useState('upload')

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧑‍🏫 老師後台</h1>
      <p className="text-gray-500 text-sm mb-4">題庫管理與查詢</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'upload', label: '📤 上傳題庫' },
          { key: 'browse', label: '🔍 題庫查詢' },
          { key: 'dupes',  label: '🔁 重複偵測' },
          { key: 'users',  label: '👥 使用者' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px whitespace-nowrap ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && <UploadTab />}
      {tab === 'browse' && <BrowseTab />}
      {tab === 'dupes'  && <DupesTab />}
      {tab === 'users'  && <UsersTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab 1：上傳題庫
// ══════════════════════════════════════════════════════════════════════════════

function UploadTab() {
  const [step, setStep]           = useState(STEP.IDLE)
  const [selectedUnit, setSelectedUnit] = useState('unit1')
  const [selectedChapter, setSelectedChapter] = useState('')  // '' = 整個單元
  const [fileName, setFileName]   = useState('')
  const [questions, setQuestions] = useState([])
  const [warnings, setWarnings]   = useState([])
  const [importResult, setImportResult] = useState(null)
  const [error, setError]         = useState('')
  const [previewIdx, setPreviewIdx] = useState(0)
  const [showOnlyReview, setShowOnlyReview] = useState(false)
  const fileRef = useRef()

  // 切換單元時重置章節選擇
  function handleUnitChange(unitId) {
    setSelectedUnit(unitId)
    setSelectedChapter('')
  }

  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.docx')) { setError('請上傳 .docx 格式的題庫檔案'); return }
    setFileName(file.name); setError(''); setStep(STEP.PARSING)
    try {
      const buf = await file.arrayBuffer()
      const chapterId = selectedChapter || null
      const { questions: qs, warnings: ws } = await parseDocxQuestions(buf, selectedUnit, chapterId)
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
          <select value={selectedUnit} onChange={e => handleUnitChange(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-3 text-sm focus:ring-2 focus:ring-primary outline-none">
            {UNITS.map(u => <option key={u.id} value={u.id}>{u.name} — {u.title_zh}</option>)}
          </select>

          <label className="block text-sm font-medium text-gray-600 mb-1">所屬章節（選填）</label>
          <select value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full mb-5 text-sm focus:ring-2 focus:ring-primary outline-none">
            <option value="">— 整個單元（不指定章節）</option>
            {(UNIT_MAP[selectedUnit]?.chapters ?? []).map(ch => (
              <option key={ch.id} value={ch.id}>Ch{ch.no} — {ch.zh}</option>
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
        </div>
      )}

      {step === STEP.PREVIEW && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-700">② 解析結果預覽</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
              範圍：{UNIT_MAP[selectedUnit]?.name}
              {selectedChapter
                ? ` › Ch${UNIT_MAP[selectedUnit]?.chapters?.find(c => c.id === selectedChapter)?.no} ${UNIT_MAP[selectedUnit]?.chapters?.find(c => c.id === selectedChapter)?.zh}`
                : '（整個單元）'}
            </span>
          </div>
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
          <p className="text-gray-400 text-xs mb-6">同一範圍（單元／章節）重複上傳會更新，不同範圍各自獨立不覆蓋</p>
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
  const [selectedChapter, setSelectedChapter] = useState('')  // '' = 全單元
  const [questions, setQuestions]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [unitCounts, setUnitCounts]     = useState({})
  const [expandedId, setExpandedId]     = useState(null)
  const [editingQ, setEditingQ]         = useState(null)
  const [filterReview, setFilterReview] = useState(false)
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [recalcing, setRecalcing]       = useState(false)

  const loadUnit = useCallback(async (unitId) => {
    setLoading(true); setExpandedId(null); setSearch(''); setFilterReview(false); setSelected(new Set()); setSelectedChapter('')
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
    setSelected(prev => { const s = new Set(prev); s.delete(q.id); return s })
  }

  async function handleBulkDelete() {
    if (!window.confirm(`確定要刪除已選取的 ${selected.size} 題？此操作無法復原。`)) return
    setBulkDeleting(true)
    try {
      await Promise.all([...selected].map(id => deleteQuestion(id)))
      setQuestions(prev => prev.filter(x => !selected.has(x.id)))
      setUnitCounts(prev => ({ ...prev, [selectedUnit]: (prev[selectedUnit] ?? selected.size) - selected.size }))
      setSelected(new Set())
    } finally {
      setBulkDeleting(false)
    }
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(q => q.id)))
    }
  }

  function handleEditSaved(updated) {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))
    setEditingQ(null)
  }

  const filtered = questions
    .filter(q => !selectedChapter || q.chapter === selectedChapter)
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
        {/* 章節篩選 */}
        {(UNIT_MAP[selectedUnit]?.chapters?.length ?? 0) > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            <button
              onClick={() => setSelectedChapter('')}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                selectedChapter === '' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              全部
            </button>
            {UNIT_MAP[selectedUnit].chapters.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  selectedChapter === ch.id ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Ch{ch.no} {ch.zh}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-700">{UNITS.find(u => u.id === selectedUnit)?.name} 題目清單</h2>
            <span className="text-xs text-gray-400">{questions.length} 題</span>
            {needsReviewCount > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠️ {needsReviewCount} 需確認</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              disabled={recalcing}
              onClick={async () => {
                setRecalcing(true)
                try {
                  const n = await recalcAllAutoStars()
                  alert(`✅ 已補算 ${n} 題的自動星號`)
                  loadUnit(selectedUnit)
                } catch (e) {
                  alert(`補算失敗：${e.message}`)
                } finally {
                  setRecalcing(false)
                }
              }}
              className="text-xs px-2 py-1 border rounded text-amber-600 border-amber-300 hover:bg-amber-50 disabled:opacity-40 whitespace-nowrap transition">
              {recalcing ? '補算中…' : '★ 補算星號'}
            </button>
            <button onClick={() => loadUnit(selectedUnit)} className="text-xs px-2 py-1 border rounded text-gray-500 hover:bg-gray-50">↻ 重新整理</button>
          </div>
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

        {/* 批次操作列 */}
        {filtered.length > 0 && !loading && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <button onClick={toggleSelectAll}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
              {selected.size === filtered.length && filtered.length > 0 ? '✕ 取消全選' : '全選'}
            </button>
            {selected.size > 0 && (
              <>
                <span className="text-xs text-gray-500">已選 {selected.size} 題</span>
                <button onClick={handleBulkDelete} disabled={bulkDeleting}
                  className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition whitespace-nowrap ml-auto">
                  {bulkDeleting ? '刪除中…' : `刪除已選取 (${selected.size})`}
                </button>
              </>
            )}
          </div>
        )}

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
                checked={selected.has(q.id)}
                onCheck={() => toggleSelect(q.id)}
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
  const [selected, setSelected]   = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function scan() {
    setLoading(true); setSelected(new Set())
    try {
      const qs = await getAllQuestions()
      setAllQ(qs)
      const map = {}
      for (const q of qs) {
        const key = (q.question_en || q.question_zh || '').toLowerCase().replace(/\s+/g, ' ').trim()
        if (!key) continue
        if (!map[key]) map[key] = []
        map[key].push(q)
      }
      setGroups(Object.values(map).filter(g => g.length > 1))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { scan() }, [])

  function removeFromState(ids) {
    const idSet = new Set(ids)
    setAllQ(prev => prev.filter(x => !idSet.has(x.id)))
    setGroups(prev => prev.map(g => g.filter(x => !idSet.has(x.id))).filter(g => g.length > 1))
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s })
  }

  async function handleDeleteOne(q) {
    if (!window.confirm(`確定要刪除「${q.unit} 題目 ${q.question_no}」？此操作無法復原。`)) return
    await deleteQuestion(q.id)
    removeFromState([q.id])
  }

  // 勾選指定單元在重複組中的所有題目
  function selectByUnit(unitId) {
    const toSelect = new Set(selected)
    for (const group of groups) {
      group.forEach(q => {
        if (q.unit === unitId) toSelect.add(q.id)
      })
    }
    setSelected(toSelect)
  }

  // 計算題目品質分數（越高越好）
  function qualityScore(q) {
    let score = 0
    if (!q.needs_review) score += 4
    if (q.answer)        score += 2
    const opts = ['A','B','C','D'].filter(k => q.options?.[k]?.en || q.options?.[k]?.zh)
    score += opts.length  // 最多加 4
    return score
  }

  // 自動判斷：每組保留品質最佳的一筆，品質相同保留 unit 編號最小者
  function autoSelectDupes() {
    const toSelect = new Set()
    for (const group of groups) {
      const sorted = [...group].sort((a, b) => {
        const diff = qualityScore(b) - qualityScore(a)
        if (diff !== 0) return diff
        // 品質相同：依 unit 編號排序（unit1 < unit2 …）
        return (a.unit || '').localeCompare(b.unit || '')
      })
      const keep = sorted[0]
      sorted.slice(1).forEach(q => toSelect.add(q.id))
    }
    setSelected(toSelect)
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!window.confirm(`確定要刪除選取的 ${selected.size} 題？此操作無法復原。`)) return
    setBulkDeleting(true)
    try {
      await Promise.all([...selected].map(id => deleteQuestion(id)))
      removeFromState([...selected])
    } finally {
      setBulkDeleting(false)
    }
  }

  const totalDupes = groups.reduce((a, g) => a + g.length, 0)

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
            {/* 批次操作列 */}
            {(() => {
              // 計算所有重複題目涉及的單元（排序）
              const dupUnits = [...new Set(groups.flat().map(q => q.unit))].sort()
              return (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-yellow-700 flex-1">
                      ⚠️ 發現 <strong>{groups.length}</strong> 組，共 <strong>{totalDupes}</strong> 題重複
                    </span>
                    {selected.size > 0 && (
                      <span className="text-xs text-gray-500">已勾選 {selected.size} 題</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 whitespace-nowrap">勾選：</span>
                    <button onClick={autoSelectDupes}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition whitespace-nowrap">
                      自動（品質最佳保留）
                    </button>
                    {dupUnits.map(uid => (
                      <button key={uid} onClick={() => selectByUnit(uid)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition whitespace-nowrap">
                        勾選 {uid} 的重複
                      </button>
                    ))}
                    {selected.size > 0 && (
                      <button onClick={() => setSelected(new Set())}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-500 hover:bg-white transition whitespace-nowrap">
                        ✕ 取消全部
                      </button>
                    )}
                    <button
                      onClick={handleBulkDelete}
                      disabled={selected.size === 0 || bulkDeleting}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition whitespace-nowrap ml-auto">
                      {bulkDeleting ? '刪除中…' : `刪除已選取 ${selected.size > 0 ? `(${selected.size})` : ''}`}
                    </button>
                  </div>
                </div>
              )
            })()}

            {groups.map((group, gi) => {
              // 找本組品質最佳的那筆
              const bestId = [...group].sort((a, b) => {
                const diff = qualityScore(b) - qualityScore(a)
                return diff !== 0 ? diff : (a.unit || '').localeCompare(b.unit || '')
              })[0].id

              return (
              <div key={gi} className="border border-yellow-200 rounded-xl overflow-hidden">
                <div className="bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800 flex items-center justify-between">
                  <span>第 {gi + 1} 組（{group.length} 筆重複）</span>
                  <button onClick={() => group.filter(q => q.id !== bestId).forEach(q => toggleSelect(q.id))}
                    className="text-yellow-600 hover:text-yellow-800 underline font-normal">
                    勾選此組重複
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.map((q) => (
                    <div key={q.id} className={`flex items-start gap-3 px-3 py-3 text-sm transition ${selected.has(q.id) ? 'bg-red-50' : ''}`}>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)}
                        className="mt-1 shrink-0 cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-gray-700">{q.unit} — 題目 {q.question_no}</span>
                          {q.id === bestId && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">★ 保留</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${q.needs_review ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {q.needs_review ? '⚠️ 需確認' : '✓ 正常'}
                          </span>
                          {q.answer && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">答案 {q.answer}</span>}
                          {q.sources?.length > 0 && <span className="text-xs text-gray-400">{q.sources[0]}</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{(q.question_zh || q.question_en || '').slice(0, 80)}</p>
                      </div>
                      <button onClick={() => handleDeleteOne(q)}
                        className="shrink-0 text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition">
                        刪除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )
            })}
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
    chapter:     q.chapter     || '',
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
        chapter:     form.chapter || null,
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

          {/* 單元 + 章節 + 答案 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">所屬單元</label>
              <select value={form.unit} onChange={e => { set('unit', e.target.value); set('chapter', '') }}
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">所屬章節（選填）</label>
            <select value={form.chapter} onChange={e => set('chapter', e.target.value)}
              className="border rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary outline-none">
              <option value="">— 整個單元（不指定章節）</option>
              {(UNIT_MAP[form.unit]?.chapters ?? []).map(ch => (
                <option key={ch.id} value={ch.id}>Ch{ch.no} — {ch.zh}</option>
              ))}
            </select>
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

function QuestionRow({ q, expanded, checked, onCheck, onToggle, onEdit, onDelete }) {
  const preview = (q.question_zh || q.question_en || '').slice(0, 60)
  return (
    <div className={`border rounded-xl overflow-hidden transition ${q.needs_review ? 'border-yellow-200' : 'border-gray-100'}`}>
      <div className={`flex items-center gap-2 px-3 py-2 text-sm ${q.needs_review ? 'bg-yellow-50' : 'bg-white'}`}>
        {/* Checkbox */}
        {onCheck && (
          <input type="checkbox" checked={!!checked} onChange={onCheck}
            className="shrink-0 w-3.5 h-3.5 accent-primary cursor-pointer"
            onClick={e => e.stopPropagation()} />
        )}
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
          {(() => {
            const stars = q.auto_stars ?? (() => {
              const n = (q.sources ?? []).length
              return n >= 3 ? 5 : n === 2 ? 4 : n === 1 ? 3 : 0
            })()
            return stars > 0
              ? <span className="text-xs text-amber-400 shrink-0 font-bold">{'★'.repeat(stars)}</span>
              : null
          })()}
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
        {(() => {
          const n = (q.sources ?? []).length
          const stars = n >= 3 ? 5 : n === 2 ? 4 : n === 1 ? 3 : 0
          return stars > 0
            ? <span className="text-xs bg-amber-50 border border-amber-300 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                {'★'.repeat(stars)} （考古{n}次）
              </span>
            : <span className="text-xs text-gray-300 px-2 py-0.5 rounded-full border border-gray-200">☆ 未出現</span>
        })()}
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

// ══════════════════════════════════════════════════════════════════════════════
// Tab 4：使用者管理
// ══════════════════════════════════════════════════════════════════════════════

function formatDateTime(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function UsersTab() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState(null)   // uid of expanded row
  const [history, setHistory]   = useState({})     // { [uid]: [...] }
  const [histLoading, setHistLoading] = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    getAllUsers()
      .then(data => { setUsers(data); setLoading(false) })
      .catch(e  => { setError(e.message); setLoading(false) })
  }, [])

  async function toggleHistory(uid) {
    if (expanded === uid) { setExpanded(null); return }
    setExpanded(uid)
    if (history[uid]) return  // 已載入
    setHistLoading(true)
    try {
      const logs = await getUserLoginHistory(uid, 20)
      setHistory(prev => ({ ...prev, [uid]: logs }))
    } catch (e) {
      setHistory(prev => ({ ...prev, [uid]: [] }))
    } finally {
      setHistLoading(false)
    }
  }

  const filtered = users.filter(u =>
    !search ||
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin text-3xl">🧬</div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
  )

  return (
    <div>
      {/* 統計列 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow px-4 py-3 text-center">
          <div className="text-2xl font-bold text-primary">{users.length}</div>
          <div className="text-xs text-gray-500">總使用者數</div>
        </div>
        <div className="bg-white rounded-xl shadow px-4 py-3 text-center">
          <div className="text-2xl font-bold text-secondary">
            {users.reduce((s, u) => s + (u.login_count ?? 0), 0)}
          </div>
          <div className="text-xs text-gray-500">總登入次數</div>
        </div>
        <div className="bg-white rounded-xl shadow px-4 py-3 text-center col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-accent">
            {users.filter(u => {
              if (!u.last_login) return false
              const d = u.last_login.toDate ? u.last_login.toDate() : new Date(u.last_login)
              return (Date.now() - d.getTime()) < 7 * 24 * 3600 * 1000
            }).length}
          </div>
          <div className="text-xs text-gray-500">7 天內活躍</div>
        </div>
      </div>

      {/* 搜尋 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋姓名或 Email…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      {/* 使用者清單 */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-10">找不到使用者</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.uid} className="bg-white rounded-xl shadow overflow-hidden">
              {/* 使用者列 */}
              <button
                onClick={() => toggleHistory(u.uid)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                {/* 頭像 */}
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName}
                    className="w-9 h-9 rounded-full border border-gray-200 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0">
                    {u.displayName?.[0] ?? '?'}
                  </div>
                )}

                {/* 姓名 / Email */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800 truncate">{u.displayName ?? '（未知）'}</div>
                  <div className="text-xs text-gray-400 truncate">{u.email}</div>
                </div>

                {/* 統計 */}
                <div className="hidden sm:flex flex-col items-end text-xs text-gray-500 shrink-0">
                  <span>最後登入：{formatDateTime(u.last_login)}</span>
                  <span>首次登入：{formatDateTime(u.first_login)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {u.login_count ?? 0} 次
                  </span>
                  <span className="text-gray-400 text-xs">{expanded === u.uid ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* 手機版：日期補充 */}
              <div className="sm:hidden px-4 pb-2 text-xs text-gray-400 flex gap-3">
                <span>最後：{formatDateTime(u.last_login)}</span>
                <span>首次：{formatDateTime(u.first_login)}</span>
              </div>

              {/* 展開：登入歷史 */}
              {expanded === u.uid && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="text-xs font-semibold text-gray-500 mb-2">最近 20 筆登入紀錄</div>
                  {histLoading && !history[u.uid] ? (
                    <div className="text-xs text-gray-400">載入中…</div>
                  ) : (history[u.uid] ?? []).length === 0 ? (
                    <div className="text-xs text-gray-400">無歷史紀錄（此使用者在功能上線前登入）</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(history[u.uid] ?? []).map((log, idx) => (
                        <div key={log.id}
                          className="bg-gray-50 rounded-lg px-2 py-1.5 text-xs text-gray-600 flex items-center gap-1.5">
                          <span className="text-gray-300 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                          <span>{formatDateTime(log.at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
