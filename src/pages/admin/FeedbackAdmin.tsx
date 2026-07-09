import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Camera,
  PaperPlaneTilt,
  ArrowSquareOut,
  GithubLogo,
  Trash,
  PencilSimple,
  CheckCircle,
} from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { screenLabel } from '../../lib/screenLabel'
import { getFeedbackScreenshotSignedUrl, uploadFeedbackScreenshot } from '../../lib/storage'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { isFeedbackAdmin } from '../../lib/admin'
import './feedback-admin.css'

interface FeedbackRow {
  id: string
  email: string | null
  note: string
  path: string | null
  category: string | null
  context: string | null
  screenshot_path: string | null
  created_at: string
  status: string
  admin_notes: string | null
  github_issue_number: number | null
  github_pr_url: string | null
  sent_at: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'תקלה', feature: 'רעיון', question: 'שאלה', other: 'אחר',
}

// The DB stores English status keys; the pipeline moves them. These are the owner-facing
// Hebrew labels. 'fixed' items live in the archive; everything else is "active".
const STATUS_LABEL: Record<string, string> = {
  new: 'חדש', sent: 'נשלח', in_progress: 'בעבודה',
  awaiting_review: 'ממתין לבדיקה', fixed: 'תוקן', failed: 'נכשל',
}

// Category tabs + a separate archive. Archive = whatever reached 'fixed' (Phase 2 adds a
// manual "mark as closed" that writes status via a service-role function).
const TABS = [
  { key: 'all', label: 'הכול' },
  { key: 'bug', label: 'תקלות' },
  { key: 'feature', label: 'רעיונות' },
  { key: 'question', label: 'שאלות' },
  { key: 'other', label: 'אחר' },
  { key: 'archive', label: 'ארכיון' },
] as const
type TabKey = (typeof TABS)[number]['key']

function normalizeFeedback(rows: unknown): FeedbackRow[] {
  return ((rows as Record<string, unknown>[]) ?? []).map(r => ({
    id: String(r.id),
    email: (r.email as string | null) ?? null,
    note: String(r.note ?? ''),
    path: (r.path as string | null) ?? null,
    category: (r.category as string | null) ?? null,
    context: (r.context as string | null) ?? null,
    screenshot_path: (r.screenshot_path as string | null) ?? null,
    created_at: String(r.created_at ?? ''),
    status: (r.status as string) ?? 'new',
    admin_notes: (r.admin_notes as string | null) ?? null,
    github_issue_number: (r.github_issue_number as number | null) ?? null,
    github_pr_url: (r.github_pr_url as string | null) ?? null,
    sent_at: (r.sent_at as string | null) ?? null,
  }))
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FeedbackAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Per-item action state.
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [adminDraft, setAdminDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [sendConfirmId, setSendConfirmId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // False if migration 038's columns aren't live yet — keeps "send" disabled.
  const [pipelineReady, setPipelineReady] = useState(true)

  // Create-a-new-item form.
  const [showCreate, setShowCreate] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [newShot, setNewShot] = useState<File | null>(null)

  const [toast, setToast] = useState<string | null>(null)
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function loadFeedback() {
    const full = 'id, email, note, path, category, context, screenshot_path, created_at, status, admin_notes, github_issue_number, github_pr_url, sent_at'
    const primary = await supabase.from('feedback').select(full).order('created_at', { ascending: false })
    if (!primary.error) { setPipelineReady(true); setFeedback(normalizeFeedback(primary.data)); setLoading(false); return }
    // Schema-cache lag (038/034 not live) — fall back so the inbox still loads.
    if (/status|admin_notes|github_|screenshot_path|sent_at|column|schema|PGRST204/i.test(primary.error.message ?? '')) {
      setPipelineReady(false)
      const fb = await supabase.from('feedback')
        .select('id, email, note, path, category, context, created_at')
        .order('created_at', { ascending: false })
      setFeedback(normalizeFeedback(fb.data))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadFeedback()
  }, [])

  const selected = useMemo(() => feedback.find(f => f.id === selectedId) ?? null, [feedback, selectedId])

  // Load the attached screenshot (signed URL) when an item is opened.
  useEffect(() => {
    setShotUrl(null)
    if (!selected?.screenshot_path) return
    let alive = true
    getFeedbackScreenshotSignedUrl(selected.screenshot_path)
      .then(url => { if (alive) setShotUrl(url) })
      .catch(() => { /* leave as null — show a fallback link */ })
    return () => { alive = false }
  }, [selected?.id, selected?.screenshot_path])

  // Seed the editable drafts whenever a different item is opened.
  useEffect(() => {
    setEditingNote(false)
    setNoteDraft(selected?.note ?? '')
    setAdminDraft(selected?.admin_notes ?? '')
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, bug: 0, feature: 0, question: 0, other: 0, archive: 0 }
    for (const f of feedback) {
      if (f.status === 'fixed') { c.archive++; continue }
      c.all++
      const cat = f.category && c[f.category] !== undefined ? f.category : 'other'
      c[cat]++
    }
    return c
  }, [feedback])

  const visible = useMemo(() => {
    if (tab === 'archive') return feedback.filter(f => f.status === 'fixed')
    const active = feedback.filter(f => f.status !== 'fixed')
    if (tab === 'all') return active
    if (tab === 'other') return active.filter(f => !f.category || !['bug', 'feature', 'question'].includes(f.category))
    return active.filter(f => f.category === tab)
  }, [feedback, tab])

  // ── Actions ──────────────────────────────────────────────────────────────────
  function viewShotNewTab(path: string) {
    const win = window.open('', '_blank')
    getFeedbackScreenshotSignedUrl(path)
      .then(url => { if (win) win.location.href = url; else window.open(url, '_blank') })
      .catch(() => win?.close())
  }

  async function saveNotes(id: string) {
    const note = noteDraft.trim()
    const admin_notes = adminDraft.trim() || null
    if (!note) { showToast('התיאור לא יכול להיות ריק'); return }
    setSavingNotes(true)
    const { error } = await supabase.from('feedback').update({ note, admin_notes }).eq('id', id)
    setSavingNotes(false)
    if (error) { showToast('השמירה נכשלה — נסו שוב'); return }
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, note, admin_notes } : f))
    setEditingNote(false)
  }

  async function deleteFeedback(id: string) {
    const removed = feedback.find(f => f.id === id)
    setDeleteConfirmId(null)
    setSelectedId(null)
    setFeedback(prev => prev.filter(f => f.id !== id))
    const { error } = await supabase.from('feedback').delete().eq('id', id)
    if (error && removed) {
      setFeedback(prev => [removed, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      showToast('המחיקה נכשלה — נסו שוב')
    }
  }

  async function createItem() {
    if (!user || !newNote.trim()) return
    setBusyId('new')
    const ins = await supabase.from('feedback')
      .insert({ owner_id: user.id, email: user.email ?? null, note: newNote.trim() })
      .select('id').single()
    if (ins.error || !ins.data) { setBusyId(null); showToast('היצירה נכשלה'); return }
    if (newShot) {
      try {
        const path = await uploadFeedbackScreenshot(newShot, ins.data.id as string, user.id)
        await supabase.from('feedback').update({ screenshot_path: path }).eq('id', ins.data.id as string)
      } catch { /* best-effort — item saved without the image */ }
    }
    setBusyId(null); setShowCreate(false); setNewNote(''); setNewShot(null)
    loadFeedback()
  }

  async function sendToClaude(id: string) {
    setSendConfirmId(null); setBusyId(id)
    const res = await supabase.functions.invoke('send-feedback-to-claude', { body: { feedback_id: id } })
    setBusyId(null)
    if (res.error) {
      let msg = 'השליחה נכשלה — נסו שוב'
      try {
        const ctx = (res.error as unknown as { context?: Response }).context
        const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
        if (body?.error) msg = body.error
      } catch { /* keep the generic message */ }
      showToast(msg)
      return
    }
    loadFeedback()
  }

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!isFeedbackAdmin(user?.email)) return <Navigate to="/" replace />

  const activeCount = feedback.filter(f => f.status !== 'fixed').length
  const lockedByOther = (id: string) =>
    feedback.some(o => o.id !== id && (o.status === 'sent' || o.status === 'in_progress'))

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const f = selected
    const canSend = f.status === 'new' || f.status === 'failed'
    return (
      <div className="page fbadmin-page">
        <div className="fbadmin-header">
          <button className="fbadmin-back" aria-label="חזרה לרשימה" onClick={() => setSelectedId(null)}>
            <ArrowRight size={20} />
          </button>
          <div className="fbadmin-head-titles">
            <span className={`fbadmin-status s-${f.status}`}>{STATUS_LABEL[f.status] ?? f.status}</span>
            {f.category && <span className={`fbadmin-cat c-${f.category}`}>{CATEGORY_LABEL[f.category] ?? f.category}</span>}
          </div>
        </div>

        <div className="fbadmin-detail">
          {/* ── מול הלקוח — the report ── */}
          <section className="fbadmin-channel">
            <h3 className="fbadmin-channel-h">מול הלקוח</h3>
            <div className="fbadmin-bubble-row">
              <div className="fbadmin-bubble from-client">
                {editingNote ? (
                  <textarea className="fbadmin-edit" rows={4} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
                ) : (
                  <p>{f.note}</p>
                )}
              </div>
            </div>
            <div className="fbadmin-report-meta">
              {(f.path || f.context) && <span>{screenLabel(f.path)}{f.context ? ` · ${f.context}` : ''}</span>}
              <span>{f.email ?? '—'} · {fmtDateTime(f.created_at)}</span>
            </div>

            {f.screenshot_path && (
              shotUrl ? (
                <button type="button" className="fbadmin-shot" onClick={() => viewShotNewTab(f.screenshot_path!)}>
                  <img src={shotUrl} alt="צילום מסך מצורף" loading="lazy" />
                </button>
              ) : (
                <button type="button" className="fbadmin-shot-loading" onClick={() => viewShotNewTab(f.screenshot_path!)}>
                  <Camera size={14} weight="duotone" /> טוען צילום מצורף…
                </button>
              )
            )}

            <p className="fbadmin-soon">מענה ישיר ללקוח + סימון "טופל" יתווספו בשלב הבא.</p>
          </section>

          {/* ── מול הבוט — the fix pipeline ── */}
          <section className="fbadmin-channel">
            <h3 className="fbadmin-channel-h">מול הבוט</h3>
            <ol className="fbadmin-timeline">
              <li className="done">
                <span className="fbadmin-tl-dot" />
                <div><b>התקבל</b><span className="fbadmin-tl-when">{fmtDateTime(f.created_at)}</span></div>
              </li>
              {f.status !== 'new' && (
                <li className="done">
                  <span className="fbadmin-tl-dot" />
                  <div>
                    <b>נשלח לבוט</b>
                    {f.sent_at && <span className="fbadmin-tl-when">{fmtDateTime(f.sent_at)}</span>}
                    {f.github_issue_number != null && <span className="fbadmin-tl-when">תקלה #{f.github_issue_number}</span>}
                  </div>
                </li>
              )}
              {f.status === 'in_progress' && (
                <li className="active">
                  <span className="fbadmin-tl-dot" />
                  <div><b>הבוט עובד על התיקון…</b></div>
                </li>
              )}
              {f.status === 'awaiting_review' && (
                <li className="active">
                  <span className="fbadmin-tl-dot" />
                  <div><b>התיקון מוכן — בדוק ואשר</b><span className="fbadmin-tl-when">בדוק באפליקציה שהתקלה נפתרה, ואז מזג את בקשת-המיזוג</span></div>
                </li>
              )}
              {f.status === 'fixed' && (
                <li className="done">
                  <span className="fbadmin-tl-dot" />
                  <div><b>תוקן ומוזג ✓</b></div>
                </li>
              )}
              {f.status === 'failed' && (
                <li className="failed">
                  <span className="fbadmin-tl-dot" />
                  <div><b>הבוט לא הצליח</b><span className="fbadmin-tl-when">אפשר לחדד את ההערות ולשלוח שוב</span></div>
                </li>
              )}
            </ol>

            <label className="fbadmin-field-label">הערות שלך לבוט <span>(נשלחות יחד עם התקלה)</span></label>
            <textarea
              className="fbadmin-admin-notes"
              rows={2}
              placeholder="הנחיות/הקשר לבוט לפני השליחה…"
              value={adminDraft}
              onChange={e => setAdminDraft(e.target.value)}
            />
            {adminDraft.trim() !== (f.admin_notes ?? '').trim() && (
              <button className="fbadmin-btn ghost sm" disabled={savingNotes} onClick={() => saveNotes(f.id)}>
                {savingNotes ? 'שומר…' : 'שמור הערה'}
              </button>
            )}

            <div className="fbadmin-detail-actions">
              {canSend && (
                <button
                  className="fbadmin-btn primary"
                  disabled={lockedByOther(f.id) || busyId === f.id || !pipelineReady}
                  title={!pipelineReady ? 'המערכת עדיין לא מוכנה' : lockedByOther(f.id) ? 'יש פריט אחר בתהליך — יש להמתין לסיומו' : 'שליחה לבוט לתיקון'}
                  onClick={() => setSendConfirmId(f.id)}
                >
                  <PaperPlaneTilt size={15} weight="fill" /> {busyId === f.id ? 'שולח…' : 'שלח לבוט לתיקון'}
                </button>
              )}
              {f.github_pr_url && (
                <a className="fbadmin-btn ghost" href={f.github_pr_url} target="_blank" rel="noreferrer">
                  <ArrowSquareOut size={15} /> בקשת-מיזוג
                </a>
              )}
              {f.github_issue_number != null && (
                <a className="fbadmin-btn ghost" href={`https://github.com/tulios123/apartment/issues/${f.github_issue_number}`} target="_blank" rel="noreferrer">
                  <GithubLogo size={15} /> תקלה #{f.github_issue_number}
                </a>
              )}
            </div>
          </section>

          {/* ── Footer: edit / delete ── */}
          <div className="fbadmin-footer-actions">
            {editingNote ? (
              <>
                <button className="fbadmin-btn ghost" onClick={() => { setEditingNote(false); setNoteDraft(f.note) }}>ביטול</button>
                <button className="fbadmin-btn primary" disabled={savingNotes} onClick={() => saveNotes(f.id)}>
                  {savingNotes ? 'שומר…' : 'שמור דיווח'}
                </button>
              </>
            ) : (
              <button className="fbadmin-btn ghost" onClick={() => setEditingNote(true)}>
                <PencilSimple size={15} /> ערוך דיווח
              </button>
            )}
            <button className="fbadmin-btn danger" onClick={() => setDeleteConfirmId(f.id)}>
              <Trash size={15} /> מחק
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={sendConfirmId !== null}
          title="לשלוח לבוט?"
          message="ייפתח issue בגיטהאב והבוט יתחיל לתקן ולפתוח בקשת-מיזוג. אפשר פריט אחד בכל פעם."
          confirmLabel="שלח"
          onConfirm={() => sendConfirmId && sendToClaude(sendConfirmId)}
          onCancel={() => setSendConfirmId(null)}
        />
        <ConfirmDialog
          open={deleteConfirmId !== null}
          title="למחוק את הפריט?"
          message="הפריט יימחק לצמיתות."
          confirmLabel="מחק"
          onConfirm={() => deleteConfirmId && deleteFeedback(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
        {toast && <div className="fbadmin-toast" role="status" aria-live="polite">{toast}</div>}
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="page fbadmin-page">
      <div className="fbadmin-header">
        <button className="fbadmin-back" aria-label="חזרה" onClick={() => navigate('/settings')}>
          <ArrowRight size={20} />
        </button>
        <h1>ניהול משוב {activeCount > 0 && <span className="fbadmin-count">{activeCount}</span>}</h1>
        <button className="fbadmin-new" onClick={() => setShowCreate(v => !v)}>{showCreate ? 'סגור' : '+ חדש'}</button>
      </div>

      {showCreate && (
        <div className="fbadmin-create">
          <textarea rows={3} placeholder="תיאור התקלה או הרעיון…" value={newNote} onChange={e => setNewNote(e.target.value)} />
          <label className="fbadmin-shotpick">
            <Camera size={14} weight="duotone" /> {newShot ? newShot.name : 'צירוף צילום מסך (אופציונלי)'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewShot(e.target.files?.[0] ?? null)} />
          </label>
          <div className="fbadmin-detail-actions">
            <button className="fbadmin-btn ghost" onClick={() => { setShowCreate(false); setNewNote(''); setNewShot(null) }}>ביטול</button>
            <button className="fbadmin-btn primary" onClick={createItem} disabled={!newNote.trim() || busyId === 'new'}>
              {busyId === 'new' ? 'שומר…' : 'צור פריט'}
            </button>
          </div>
        </div>
      )}

      <div className="fbadmin-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`fbadmin-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="fbadmin-tab-count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="fbadmin-empty">טוען…</p>
      ) : visible.length === 0 ? (
        <p className="fbadmin-empty">{tab === 'archive' ? 'אין עדיין פריטים בארכיון.' : 'אין פריטים פה.'}</p>
      ) : (
        <div className="fbadmin-list">
          {visible.map(f => (
            <button key={f.id} className="fbadmin-card" onClick={() => setSelectedId(f.id)}>
              <div className="fbadmin-card-top">
                <span className={`fbadmin-status s-${f.status}`}>{STATUS_LABEL[f.status] ?? f.status}</span>
                {f.category && <span className={`fbadmin-cat c-${f.category}`}>{CATEGORY_LABEL[f.category] ?? f.category}</span>}
                <span className="fbadmin-card-date">{fmtDate(f.created_at)}</span>
              </div>
              <p className="fbadmin-card-note">{f.note}</p>
              <div className="fbadmin-card-meta">
                {f.screenshot_path && <span className="fbadmin-card-shot"><Camera size={12} weight="duotone" /> צילום</span>}
                {f.status === 'awaiting_review' && <span className="fbadmin-card-flag"><CheckCircle size={12} weight="fill" /> ממתין לך</span>}
                <span className="fbadmin-card-email">{f.email ?? '—'}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {toast && <div className="fbadmin-toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
