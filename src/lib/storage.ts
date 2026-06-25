import { supabase } from './supabase'

export async function uploadDocument(file: File, docId: string, userId?: string): Promise<string> {
  // getUser() is a network round-trip that validates the token. Callers that already
  // hold the user id (e.g. onboarding uploading several files) can pass it to skip
  // the redundant call — meaningful when uploading multiple files back-to-back.
  let uid = userId
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    uid = user.id
  }
  const ext = file.name.split('.').pop()
  const path = `${uid}/docs/${docId}.${ext}`
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function uploadReceipt(file: File, transactionId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const ext = file.name.split('.').pop()
  const path = `${user.id}/receipts/${transactionId}.${ext}`
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getReceiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

/**
 * Open a stored document in a new tab. Pass a window opened *synchronously*
 * inside the click handler (`window.open('', '_blank')`) — iOS Safari blocks
 * window.open after an await, so we must hold the tab open and then redirect it.
 */
export async function redirectToSignedUrl(win: Window | null, path: string): Promise<void> {
  try {
    const url = await getReceiptSignedUrl(path)
    if (win) win.location.href = url
    else window.open(url, '_blank')
  } catch {
    win?.close()
  }
}
