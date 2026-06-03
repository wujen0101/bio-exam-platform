import {
  doc, getDoc, setDoc, deleteDoc, serverTimestamp, increment,
  collection, getDocs, addDoc, writeBatch,
} from 'firebase/firestore'
import { db } from './config'

/**
 * 交卷後批次寫入作答紀錄（彙總統計）並儲存本次測驗 session
 * 路徑：student_records/{uid}/answers/{questionId}
 *       student_records/{uid}/exams/{examId}
 *
 * @param {string} uid
 * @param {Array}  questions
 * @param {object} answers   - { [index]: 'A'|'B'|'C'|'D' }
 * @param {{ mode: string, units: string[] }} meta - 測驗模式與單元
 * @returns {Promise<string>} examId
 */
export async function saveExamRecord(uid, questions, answers, meta = {}) {
  // ① 彙總統計（原有邏輯）
  const writes = questions.map(async (q, i) => {
    const userAns = answers[i]
    if (!userAns) return

    const isCorrect = userAns === q.answer
    const ref = doc(db, 'student_records', uid, 'answers', q.id)
    await setDoc(ref, {
      question_id:   q.id,
      unit:          q.unit,
      attempt_count: increment(1),
      correct_count: increment(isCorrect ? 1 : 0),
      wrong_count:   increment(isCorrect ? 0 : 1),
      last_answered: serverTimestamp(),
      last_correct:  isCorrect,
    }, { merge: true })
  })
  await Promise.all(writes)

  // ② 儲存本次測驗 session
  const correct = questions.filter((q, i) => answers[i] === q.answer).length
  const wrong   = questions.filter((q, i) => answers[i] && answers[i] !== q.answer).length
  const skip    = questions.filter((_, i) => !answers[i]).length
  const detail  = questions.map((q, i) => ({
    question_id: q.id,
    unit:        q.unit,
    user_ans:    answers[i] || null,
    correct_ans: q.answer,
    is_correct:  answers[i] === q.answer,
  }))

  const examRef = await addDoc(
    collection(db, 'student_records', uid, 'exams'),
    {
      created_at: serverTimestamp(),
      mode:       meta.mode  || 'unit',
      units:      meta.units || [],
      total:      questions.length,
      correct,
      wrong,
      skip,
      score:      Math.round((correct / questions.length) * 100),
      detail,
    }
  )
  return examRef.id
}

/**
 * 讀取學生所有彙總作答紀錄（用於 RecordPage 統計）
 */
export async function getStudentRecords(uid) {
  const snap = await getDocs(collection(db, 'student_records', uid, 'answers'))
  return snap.docs.map(d => d.data())
}

/**
 * 清除所有彙總統計（attempt/correct/wrong），保留 note/stars
 * 無統計欄位的 doc 直接刪除
 */
export async function clearAllStats(uid) {
  const snap = await getDocs(collection(db, 'student_records', uid, 'answers'))
  const BATCH_SIZE = 400
  const docs = snap.docs

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const d of chunk) {
      const data = d.data()
      const keep = {}
      if (data.note  != null) keep.note  = data.note
      if (data.stars != null) keep.stars = data.stars

      if (Object.keys(keep).length > 0) {
        // 保留 note/stars，刪除統計欄位
        batch.set(d.ref, keep)
      } else {
        batch.delete(d.ref)
      }
    }

    await batch.commit()
  }
}

/**
 * 讀取所有測驗 session（依時間倒序）
 */
export async function getExamSessions(uid) {
  const snap = await getDocs(collection(db, 'student_records', uid, 'exams'))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.created_at?.seconds ?? 0
      const tb = b.created_at?.seconds ?? 0
      return tb - ta
    })
}

/**
 * 刪除某次測驗 session，並從彙總統計中扣除該次的作答貢獻
 * - 若扣除後 attempt_count <= 0，刪除彙總紀錄（但保留 note/stars）
 */
export async function deleteExamSession(uid, sessionId) {
  // 讀取 session
  const sessionRef = doc(db, 'student_records', uid, 'exams', sessionId)
  const sessionSnap = await getDoc(sessionRef)
  if (!sessionSnap.exists()) return

  const session = sessionSnap.data()
  const detail = session.detail ?? []

  // 讀取受影響題目的現有彙總
  const affectedIds = [...new Set(detail.filter(d => d.user_ans).map(d => d.question_id))]
  const currentDocs = {}
  await Promise.all(affectedIds.map(async id => {
    const snap = await getDoc(doc(db, 'student_records', uid, 'answers', id))
    if (snap.exists()) currentDocs[id] = snap.data()
  }))

  // 批次更新（Firestore batch 上限 500）
  const BATCH_SIZE = 400
  for (let i = 0; i < affectedIds.length; i += BATCH_SIZE) {
    const chunk = affectedIds.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const qid of chunk) {
      const answered = detail.filter(d => d.question_id === qid && d.user_ans)
      if (!answered.length) continue

      const correctDelta = answered.filter(d => d.is_correct).length
      const wrongDelta   = answered.filter(d => !d.is_correct).length
      const attemptDelta = answered.length

      const cur = currentDocs[qid]
      const ref = doc(db, 'student_records', uid, 'answers', qid)

      if (cur && (cur.attempt_count ?? 0) <= attemptDelta) {
        // 扣完後無剩餘作答次數 → 只保留 note/stars，清除統計欄位
        const keepFields = {}
        if (cur.note  !== undefined) keepFields.note  = cur.note
        if (cur.stars !== undefined) keepFields.stars = cur.stars
        if (Object.keys(keepFields).length > 0) {
          batch.set(ref, keepFields)
        } else {
          batch.delete(ref)
        }
      } else {
        // 只扣減統計數字
        batch.update(ref, {
          attempt_count: increment(-attemptDelta),
          correct_count: increment(-correctDelta),
          wrong_count:   increment(-wrongDelta),
        })
      }
    }

    await batch.commit()
  }

  // 刪除 session 文件
  await deleteDoc(sessionRef)
}

/**
 * 儲存單題備註與星號（merge，不影響作答統計）
 */
export async function saveQuestionAnnotation(uid, questionId, data) {
  const ref = doc(db, 'student_records', uid, 'answers', questionId)
  await setDoc(ref, data, { merge: true })
}

/**
 * 批次讀取一組題目的備註與星號
 */
export async function getQuestionAnnotations(uid, questionIds) {
  const results = {}
  await Promise.all(questionIds.map(async id => {
    const snap = await getDoc(doc(db, 'student_records', uid, 'answers', id))
    if (snap.exists()) {
      const d = snap.data()
      results[id] = {
        note: d.note ?? '',
        stars: d.stars ?? 0,
        bookmarked: d.bookmarked ?? false,
        fuzzy: d.fuzzy ?? false,
      }
    } else {
      results[id] = { note: '', stars: 0, bookmarked: false, fuzzy: false }
    }
  }))
  return results
}
