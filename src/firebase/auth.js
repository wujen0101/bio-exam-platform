import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './config'

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

export async function logout() {
  await signOut(auth)
}
