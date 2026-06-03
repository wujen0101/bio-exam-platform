/**
 * questions.js — Firestore 題庫讀寫函式
 */

import {
  collection, doc, setDoc, deleteDoc, updateDoc, getDocs,
  query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

const COL = 'questions'

/**
 * 批次寫入題目到 Firestore
 * Firestore writeBatch 上限 500 筆，超過自動分批
 * @param {object[]} questions - parseDocx 回傳的題目陣列
 * @param {string} uploadedBy - 上傳者 uid
 * @returns {Promise<{ success: number, failed: number }>}
 */
export async function importQuestions(questions, uploadedBy) {
  let success = 0
  let failed = 0
  const BATCH_SIZE = 400

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const chunk = questions.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const q of chunk) {
      try {
        // docId = unit_題號，例如 unit1_001
        const docId = `${q.unit}_${String(q.question_no).padStart(3, '0')}`
        const ref = doc(db, COL, docId)
        // 依考古題出現次數計算自動星號
        const srcCount = (q.sources ?? []).length
        const auto_stars = srcCount >= 3 ? 5 : srcCount === 2 ? 4 : srcCount === 1 ? 3 : 0
        batch.set(ref, {
          ...q,
          auto_stars,
          uploaded_by: uploadedBy,
          server_ts: serverTimestamp(),
        }, { merge: true })  // merge: 已存在則更新，不覆蓋作答紀錄
        success++
      } catch {
        failed++
      }
    }

    await batch.commit()
  }

  return { success, failed }
}

/**
 * 讀取指定單元的所有題目
 * @param {string} unitId - 例如 "unit1"
 */
export async function getQuestionsByUnit(unitId) {
  const q = query(
    collection(db, COL),
    where('unit', '==', unitId),
  )
  const snap = await getDocs(q)
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return docs.sort((a, b) => (a.question_no ?? 0) - (b.question_no ?? 0))
}

/** 讀取全部題目（用於重複偵測） */
export async function getAllQuestions() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * 批次讀取指定 ID 的題目（用於 RecordPage 題目明細）
 * @param {string[]} ids
 */
export async function getQuestionsByIds(ids) {
  if (!ids.length) return []
  const { getDoc } = await import('firebase/firestore')
  const snaps = await Promise.all(ids.map(id => getDoc(doc(db, COL, id))))
  return snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }))
}

/** 刪除單題 */
export async function deleteQuestion(docId) {
  await deleteDoc(doc(db, COL, docId))
}

/**
 * 更新單題（部分欄位）
 * @param {string} docId
 * @param {object} fields - 要更新的欄位
 */
export async function updateQuestion(docId, fields) {
  // 若更新了 sources，同步重算 auto_stars
  if (fields.sources != null) {
    const n = fields.sources.length
    fields = { ...fields, auto_stars: n >= 3 ? 5 : n === 2 ? 4 : n === 1 ? 3 : 0 }
  }
  await updateDoc(doc(db, COL, docId), { ...fields, server_ts: serverTimestamp() })
}

/**
 * 從多個單元隨機抽題
 * @param {string[]} unitIds - 要出題的單元陣列
 * @param {number} total - 總題數
 * @param {object} ratios - { unitId: number(比率 0~1) }，不傳則平均分配
 */
export async function drawQuestions(unitIds, total, ratios = null) {
  const allQuestions = []

  for (const uid of unitIds) {
    const qs = await getQuestionsByUnit(uid)
    allQuestions.push({ uid, qs })
  }

  const result = []

  for (const { uid, qs } of allQuestions) {
    if (qs.length === 0) continue
    const ratio = ratios ? (ratios[uid] || 0) : (1 / unitIds.length)
    const count = Math.round(total * ratio)
    // 隨機洗牌後取前 count 題
    const shuffled = [...qs].sort(() => Math.random() - 0.5)
    result.push(...shuffled.slice(0, Math.min(count, qs.length)))
  }

  // 最終再洗牌（打亂各單元順序）
  return result.sort(() => Math.random() - 0.5)
}
