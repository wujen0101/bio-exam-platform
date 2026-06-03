/**
 * parseDocx.js
 * 瀏覽器端 docx 題庫解析器
 *
 * 支援格式（來自 Unit1_解析報告.docx）：
 *   題目 N （來源考試 A、來源考試 B） 【來源頁碼：PXX】
 *   📝 英文原題  ...題目內容...
 *   (A) ...  (B) ...  (C) ...  (D) ...  [(E) ...]
 *   📝 中文版題目  ...題目內容...
 *   (A) ...  (B) ...  (C) ...  (D) ...  [(E) ...]
 *   ✓ 正確答案：X
 *   🧠 詳細解說（逐項說明）
 *   ✓/✗ (A) ...解說...  ...  [(E) ...]
 *   🧠 記憶口訣與重點  ...內容...
 */

import mammoth from 'mammoth'

const OPTS = ['A', 'B', 'C', 'D', 'E']
const OPT_RE_SRC = '[ABCDEabcde]'

// ── 工具函式 ────────────────────────────────────────────────────────────────

/** 從題目標題行抽取來源考試清單，例如 ["111中國後中","108中國後中"] */
function parseSources(line) {
  const m = line.match(/（([^）]+)）/)
  if (!m) return []
  return m[1].split(/[、，,]/).map(s => s.trim()).filter(Boolean)
}

/** 從題目標題行抽取頁碼，例如 "P13" */
function parsePageRef(line) {
  const m = line.match(/【[^】]*[Pp](\d+)[^】]*】/)
  return m ? `P${m[1]}` : null
}

/** 抽取選項，回傳 { A, B, C, D, E }（值為 null 若未找到） */
function parseOptions(text) {
  const opts = { A: null, B: null, C: null, D: null, E: null }
  const re = new RegExp(`\\((${OPT_RE_SRC})\\)\\s*([\\s\\S]*?)(?=\\(${OPT_RE_SRC}\\)|$)`, 'g')
  let m
  while ((m = re.exec(text)) !== null) {
    const key = m[1].toUpperCase()
    opts[key] = m[2].replace(/\s+/g, ' ').trim()
  }
  return opts
}

/** 抽取正確答案字母（支援 A~E 大小寫，含括號格式） */
function parseAnswer(lines, startIdx) {
  for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
    const m = lines[i].match(new RegExp(`正確答案[：:]\\s*\\(?\\s*(${OPT_RE_SRC})\\)?`))
    if (m) return m[1].toUpperCase()
  }
  return null
}

/** 抽取各選項解說，回傳 { A, B, C, D, E } */
function parseExplanations(lines, startIdx, endIdx) {
  const expl = { A: null, B: null, C: null, D: null, E: null }
  let current = null
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim()
    const m = line.match(new RegExp(`^[✓✗❌☑]\\s*\\((${OPT_RE_SRC})\\)\\s*(.*)`))
    if (m) {
      current = m[1].toUpperCase()
      expl[current] = m[2].trim()
    } else if (current && line && !line.startsWith('🧠') && !line.startsWith('✓ 正確')) {
      expl[current] = (expl[current] || '') + ' ' + line
    }
  }
  for (const k of OPTS) {
    if (expl[k]) expl[k] = expl[k].replace(/\s+/g, ' ').trim()
  }
  return expl
}

/** 抽取記憶口訣區塊 */
function parseMemoryTips(lines, startIdx) {
  const tips = []
  let inSection = false
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.includes('記憶口訣') || line.includes('記憶重點')) { inSection = true; continue }
    if (inSection) {
      if (line.startsWith('題目') && /題目\s*\d+/.test(line)) break
      if (line) tips.push(line)
    }
  }
  return tips.join('\n').trim() || null
}

// ── 主解析函式 ───────────────────────────────────────────────────────────────

/**
 * 解析整份 docx 文字，回傳題目陣列
 * @param {ArrayBuffer} arrayBuffer - File.arrayBuffer() 的結果
 * @param {string} unitId - 題庫所屬單元，例如 "unit1"
 * @returns {Promise<{ questions: Question[], warnings: string[] }>}
 */
export async function parseDocxQuestions(arrayBuffer, unitId) {
  const result = await mammoth.extractRawText({ arrayBuffer })
  const rawText = result.value

  const warnings = [...result.messages.map(m => m.message)]
  const lines = rawText.split('\n').map(l => l.trim())

  const questions = []

  const questionStarts = []
  for (let i = 0; i < lines.length; i++) {
    if (/^題目\s*\d+/.test(lines[i])) {
      questionStarts.push(i)
    }
  }

  if (questionStarts.length === 0) {
    warnings.push('⚠️ 找不到任何題目，請確認檔案格式正確（題目需以「題目 N」開頭）')
    return { questions, warnings }
  }

  for (let qi = 0; qi < questionStarts.length; qi++) {
    const start = questionStarts[qi]
    const end = qi + 1 < questionStarts.length ? questionStarts[qi + 1] : lines.length
    const block = lines.slice(start, end)

    try {
      const q = parseSingleQuestion(block, unitId, start)
      if (q) {
        questions.push(q)
      } else {
        warnings.push(`⚠️ 第 ${qi + 1} 題解析失敗（行 ${start + 1}）`)
      }
    } catch (e) {
      warnings.push(`⚠️ 第 ${qi + 1} 題發生錯誤：${e.message}`)
    }
  }

  return { questions, warnings }
}

function parseSingleQuestion(block, unitId, globalLineOffset) {
  const headerLine = block[0]
  const noMatch = headerLine.match(/題目\s*(\d+)/)
  const questionNo = noMatch ? parseInt(noMatch[1]) : null
  const sources = parseSources(headerLine)
  const page_ref = parsePageRef(headerLine)

  let enStart = -1, zhStart = -1, detailStart = -1, memStart = -1
  for (let i = 1; i < block.length; i++) {
    const l = block[i]
    if (l.includes('英文原題') && enStart === -1) { enStart = i + 1 }
    if (l.includes('中文版題目') && zhStart === -1) { zhStart = i + 1 }
    if ((l.includes('詳細解說') || l.includes('逐項說明')) && detailStart === -1) { detailStart = i + 1 }
    if ((l.includes('記憶口訣') || l.includes('記憶重點')) && memStart === -1) { memStart = i }
  }

  // 英文題目 + 選項
  const optPat = new RegExp(`\\(${OPT_RE_SRC}\\)[^(]*`, 'g')
  const enSection = (enStart !== -1 && zhStart !== -1)
    ? block.slice(enStart, zhStart - 1).join(' ')
    : ''
  const enQuestion = enSection.replace(optPat, '').trim()
  const enOptions = parseOptions(enSection)

  // 中文題目 + 選項
  const zhSection = (zhStart !== -1 && detailStart !== -1)
    ? block.slice(zhStart, detailStart - 1).join(' ')
    : ''
  const zhQuestion = zhSection.replace(optPat, '').replace(/[-─]+/g, '').trim()
  const zhOptions = parseOptions(zhSection)

  // 合併選項，支援 A~E
  const options = {}
  for (const k of OPTS) {
    options[k] = {
      en: enOptions[k] || null,
      zh: zhOptions[k] || null,
    }
  }

  // 正確答案（支援 A~E）
  // 支援 "正確答案：E"、"正確答案：(E)"、"正確答案：(e)" 等格式
  const answerRe = new RegExp(`正確答案[：:]\\s*\\(?\\s*(${OPT_RE_SRC})\\)?`)
  const answerLineIdx = block.findIndex(l => answerRe.test(l))
  const answer = answerLineIdx !== -1
    ? (block[answerLineIdx].match(answerRe)?.[1]?.toUpperCase() || null)
    : null

  // 各選項解說
  const explEnd = memStart !== -1 ? memStart : block.length
  const explanations = detailStart !== -1
    ? parseExplanations(block, detailStart, explEnd)
    : { A: null, B: null, C: null, D: null, E: null }

  // 記憶口訣
  const memory_tips = memStart !== -1
    ? block.slice(memStart + 1).join('\n').trim() || null
    : null

  // 判斷實際出現的選項（跳過全 null 的 E）
  const activeOpts = OPTS.filter(k => options[k].en || options[k].zh)
  const hasQuestion = !!(enQuestion || zhQuestion)
  const hasAllOptions = activeOpts.length >= 4  // 至少要有 4 個選項
  const needs_review = !hasQuestion || !answer || !hasAllOptions

  return {
    unit: unitId,
    question_no: questionNo,
    sources,
    page_ref,
    question_en: enQuestion || null,
    question_zh: zhQuestion || null,
    options,
    answer,
    explanations,
    memory_tips,
    needs_review,
    _answerRaw: answerLineIdx !== -1 ? block[answerLineIdx] : null,
    imported_at: new Date().toISOString(),
  }
}
