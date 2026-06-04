import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, getDocs, serverTimestamp, increment, orderBy, query, limit,
} from 'firebase/firestore'
import { db } from './config'

/**
 * 使用者登入時呼叫：更新 users/{uid} 統計 + 寫入一筆 login_history
 */
export async function recordLogin(user) {
  const userRef = doc(db, 'users', user.uid)
  const snap    = await getDoc(userRef)

  if (!snap.exists()) {
    // 第一次登入：建立使用者文件
    await setDoc(userRef, {
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName,
      photoURL:    user.photoURL,
      login_count: 1,
      first_login: serverTimestamp(),
      last_login:  serverTimestamp(),
    })
  } else {
    // 後續登入：更新計數與最後登入時間、順便同步顯示名稱
    await updateDoc(userRef, {
      login_count: increment(1),
      last_login:  serverTimestamp(),
      displayName: user.displayName,
      photoURL:    user.photoURL,
    })
  }

  // 寫入 login_history 子集合
  await addDoc(collection(db, 'users', user.uid, 'login_history'), {
    at: serverTimestamp(),
  })
}

/**
 * 管理者查詢所有使用者清單（login_count 排序）
 */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'))
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  // 依最後登入時間降序排列
  users.sort((a, b) => {
    const ta = a.last_login?.toMillis?.() ?? 0
    const tb = b.last_login?.toMillis?.() ?? 0
    return tb - ta
  })
  return users
}

/**
 * 取得單一使用者的登入歷史（最近 N 筆）
 */
export async function getUserLoginHistory(uid, maxCount = 20) {
  const q = query(
    collection(db, 'users', uid, 'login_history'),
    orderBy('at', 'desc'),
    limit(maxCount),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
