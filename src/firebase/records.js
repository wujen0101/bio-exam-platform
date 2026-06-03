import {
  doc, getDoc, setDoc, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from './config'

/**
 * 交卷後批次寫入作答紀錄
 * 路徑：student_records/{uid}/answers/{questionId}
 * 若同一題已有紀錄，累加 attempt / correct / wrong，不覆蓋歷史
 *
 * @param {string} uid - Firebase Auth uid
 * @param {Array}  questions - 本次作答的題目陣列
 * @param {object} answers   - { [index]: 'A'|'B'|'C'|'D' }
 */
export async function saveExamRecord(uid, questions, answers) {
  const writes = questions.map(async (q, i) => {
    const userAns = answers[i]
    if (!userAns) return  // 未作答的題跳過

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
}

/**
 * 讀取學生所有作答紀錄（用於 RecordPage）
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function getStudentRecords(uid) {
  const { getDocs, collection } = await import('firebase/firestore')
  const snap = await getDocs(collection(db, 'student_records', uid, 'answers'))
  return snap.docs.map(d => d.data())
}
