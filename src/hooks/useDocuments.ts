import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { readCache, writeCache } from '../lib/queryCache'
import type { Document } from '../types'

export function useDocuments() {
  const { user } = useAuth()
  const cacheKey = user ? `documents:${user.id}` : null
  const [documents, setDocuments] = useState<Document[]>(() => readCache<Document[]>(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => readCache<Document[]>(cacheKey) == null)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) return
    const cached = readCache<Document[]>(cacheKey)
    if (cached) setDocuments(cached)
    setLoading(cached == null)
    setError(null)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else { setDocuments(data ?? []); writeCache<Document[]>(cacheKey, data ?? []) }
    setLoading(false)
  }, [user, cacheKey])

  useEffect(() => { fetch() }, [fetch])

  return { documents, loading, error, refetch: fetch }
}

export async function createDocument(doc: Omit<Document, 'created_at'>): Promise<void> {
  const { error } = await supabase.from('documents').insert(doc)
  if (error) throw error
}

export async function updateDocument(
  id: string,
  fields: Partial<Pick<Document, 'name' | 'type' | 'date'>>
): Promise<void> {
  const { error } = await supabase.from('documents').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteDocument(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from('documents').remove([storagePath])
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}
