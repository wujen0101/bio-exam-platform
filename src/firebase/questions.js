/**
 * questions.js — Firestore 題庫讀寫函式
 */

import {
  collection, doc, setDoc, getDocs,
  query, where, orderBy, writeBatch, serverTimestamp,
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
        batch.set(ref, {
          ...q,
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
    orderBy('question_no'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
