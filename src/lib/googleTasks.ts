import { supabase } from './supabase'

const BASE = 'https://tasks.googleapis.com/tasks/v1/lists/%40default'

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.provider_token ?? null
}

async function request(method: string, path: string, body?: object): Promise<unknown> {
  const token = await getToken()
  if (!token) throw new Error('No Google token')
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Tasks API ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export interface GoogleTask {
  id: string
  title: string
  status: 'needsAction' | 'completed'
  due?: string
  updated: string
}

export async function listGoogleTasks(): Promise<GoogleTask[]> {
  const data = await request('GET', '/tasks?showCompleted=true&showHidden=true&maxResults=100') as { items?: GoogleTask[] }
  return data?.items ?? []
}

export async function createGoogleTask(title: string, dueDate: string | null): Promise<GoogleTask> {
  return request('POST', '/tasks', {
    title,
    ...(dueDate ? { due: `${dueDate}T00:00:00.000Z` } : {}),
  }) as Promise<GoogleTask>
}

export async function updateGoogleTask(
  id: string,
  updates: { title?: string; due?: string | null; status?: 'needsAction' | 'completed' }
): Promise<void> {
  await request('PATCH', `/tasks/${id}`, updates)
}

export async function deleteGoogleTask(id: string): Promise<void> {
  await request('DELETE', `/tasks/${id}`)
}
