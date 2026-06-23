import { supabase } from './supabase'

// Google Tasks two-way sync is SUSPENDED (not removed) — flip to `true` to bring
// it back. While false: the OAuth `tasks` scope isn't requested (so sign-in stays
// non-sensitive / no Google verification needed for new users), the on-load sync
// is skipped, task writes don't mirror to Google, and the Settings section hides.
export const GOOGLE_TASKS_ENABLED = false

const API_BASE = 'https://tasks.googleapis.com/tasks/v1'
const LIST_NAME = 'apartment'

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.provider_token ?? localStorage.getItem('google_provider_token')
}

async function request(method: string, url: string, body?: object): Promise<unknown> {
  const token = await getToken()
  if (!token) throw new Error('No Google token')
  const res = await fetch(url, {
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

// Serialize list ID resolution so we never create the list twice
let listIdPromise: Promise<string> | null = null

export function resetListCache() {
  listIdPromise = null
}

async function resolveListId(): Promise<string> {
  const data = await request('GET', `${API_BASE}/users/@me/lists?maxResults=100`) as { items?: { id: string; title: string }[] }
  const existing = data?.items?.find(l => l.title.toLowerCase() === LIST_NAME)
  if (existing) return existing.id

  const created = await request('POST', `${API_BASE}/users/@me/lists`, { title: LIST_NAME }) as { id: string }
  return created.id
}

async function getListId(): Promise<string> {
  if (!listIdPromise) listIdPromise = resolveListId()
  return listIdPromise
}

export interface GoogleTask {
  id: string
  title: string
  status: 'needsAction' | 'completed'
  due?: string
  updated: string
}

export async function listGoogleTasks(): Promise<GoogleTask[]> {
  const listId = await getListId()
  const data = await request('GET', `${API_BASE}/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`) as { items?: GoogleTask[] }
  return data?.items ?? []
}

export async function createGoogleTask(title: string, dueDate: string | null): Promise<GoogleTask> {
  const listId = await getListId()
  return request('POST', `${API_BASE}/lists/${listId}/tasks`, {
    title,
    ...(dueDate ? { due: `${dueDate}T00:00:00.000Z` } : {}),
  }) as Promise<GoogleTask>
}

export async function updateGoogleTask(
  id: string,
  updates: { title?: string; due?: string | null; status?: 'needsAction' | 'completed' }
): Promise<void> {
  const listId = await getListId()
  await request('PATCH', `${API_BASE}/lists/${listId}/tasks/${id}`, updates)
}

export async function deleteGoogleTask(id: string): Promise<void> {
  const listId = await getListId()
  await request('DELETE', `${API_BASE}/lists/${listId}/tasks/${id}`)
}
