import { supabase } from './supabase'
import { OWNER_ID } from './constants'

export async function uploadReceipt(file: File, transactionId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${OWNER_ID}/receipts/${transactionId}.${ext}`
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export function getReceiptUrl(path: string): string {
  const { data } = supabase.storage.from('documents').getPublicUrl(path)
  return data.publicUrl
}

export async function getReceiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, 60 * 60) // 1 hour
  if (error) throw error
  return data.signedUrl
}
