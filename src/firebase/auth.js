import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './config'
import { recordLogin } from './users'

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  // 非同步記錄登入，不阻塞登入流程
  recordLogin(result.user).catch(err => console.warn('recordLogin failed:', err))
  return result.user
}

export async function logout() {
  await signOut(auth)
}
