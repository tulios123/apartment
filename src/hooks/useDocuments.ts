import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { readCache, writeCache } from '../lib/queryCache'
import type { Document } from '../types'
import { latestOnly } from '../lib/latestOnly'

export function useDocuments() {
  const { user } = useAuth()
  const cacheKey = user ? `documents:${user.id}` : null
  const [documents, setDocuments] = useState<Document[]>(() => readCache<Document[]>(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => readCache<Document[]>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)
  // SW-12: only the LATEST fetch (effect or manual refetch) may commit state.
  const guard = useRef(latestOnly())

  const fetch = useCallback(async () => {
    if (!user) return
    const fresh = guard.current.start()
    const cached = readCache<Document[]>(cacheKey)
    if (cached) setDocuments(cached)
    setLoading(cached == null)
    setError(null)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (!fresh()) return   // superseded by a newer fetch (or unmounted) — don't overwrite
    if (error) setError(error.message)
    else { setDocuments(data ?? []); writeCache<Document[]>(cacheKey, data ?? []) }
    setLoading(false)
  }, [user?.id, cacheKey])

  useEffect(() => { fetch(); return () => guard.current.invalidate() }, [fetch])

  return { documents, loading, error, refetch: fetch }
}

export async function createDocument(doc: Omit<Document, 'created_at'>): Promise<void> {
  const { error } = await supabase.from('documents').insert(doc)
  if (error) throw error
}

export async function updateDocument(
  id: string,
  // contract_id: back-linking a doc scanned before its contract existed (R12).
  fields: Partial<Pick<Document, 'name' | 'type' | 'date' | 'contract_id'>>
): Promise<void> {
  const { error } = await supabase.from('documents').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  const { error: storageErr } = await supabase.storage.from('documents').remove([storagePath])
  // Don't delete the DB record if the file removal failed — that would orphan the file
  // in storage forever (no record left to point at it for cleanup). Surface the error so
  // the caller shows a retry instead. (Removing an already-absent path is not an error.)
  if (storageErr) throw storageErr
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}
