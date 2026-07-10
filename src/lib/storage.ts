import { supabase } from './supabase'

// EDGE-17: client-side ceiling so an oversized upload fails fast with a clear message
// instead of erroring deep in storage (and being swallowed). Receipts/scans are well
// under this; HEIC photos rarely exceed a few MB.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB

// EDGE-18: a file with no dot in its name would make `split('.').pop()` return the
// whole name as the "extension". Fall back to a generic extension instead.
function fileExt(name: string): string {
  return name.includes('.') ? (name.split('.').pop() || 'bin') : 'bin'
}

function assertSize(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('הקובץ גדול מדי (עד 15MB)')
}

export async function uploadDocument(file: File, docId: string, userId?: string): Promise<string> {
  assertSize(file)
  // getUser() is a network round-trip that validates the token. Callers that already
  // hold the user id (e.g. onboarding uploading several files) can pass it to skip
  // the redundant call — meaningful when uploading multiple files back-to-back.
  let uid = userId
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    uid = user.id
  }
  const path = `${uid}/docs/${docId}.${fileExt(file.name)}`
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}


// Feedback screenshots live in their own private `feedback` bucket at
// {user_id}/{feedbackId}.{ext} — separate from financial documents so the owner's
// admin-read policy can't reach into the documents bucket. See migration 034.
export async function uploadFeedbackScreenshot(file: File, feedbackId: string, userId: string): Promise<string> {
  assertSize(file)
  // A unique name under {uid}/{feedbackId}/ so several screenshots on one item never collide
  // (the first folder is still the uid, so the folder-based storage RLS is unchanged).
  const path = `${userId}/${feedbackId}/${crypto.randomUUID()}.${fileExt(file.name)}`
  const { error } = await supabase.storage.from('feedback').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

// Delete one attached screenshot from storage (own file, or the admin). Best-effort caller.
export async function removeFeedbackScreenshot(path: string): Promise<void> {
  const { error } = await supabase.storage.from('feedback').remove([path])
  if (error) throw error
}

export async function getFeedbackScreenshotSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('feedback').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
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
