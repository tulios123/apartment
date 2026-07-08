import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, PaperPlaneTilt, ArrowSquareOut } from '@phosphor-icons/react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { resetListCache, GOOGLE_TASKS_ENABLED } from '../lib/googleTasks'
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme'
import { screenLabel } from '../lib/screenLabel'
import { getFeedbackScreenshotSignedUrl, uploadFeedbackScreenshot } from '../lib/storage'
import { InstallGuide } from '../components/InstallGuide'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { isFeedbackAdmin } from '../lib/admin'
import {
  pushSupported,
  pushConfigured,
  isInstalledPWA,
  isIOS,
  isSubscribed,
  enablePush,
  disablePush,
  sendTestNotification,
} from '../lib/push'

const GENERATION_KEY = 'monthly_generation'
// The dev/test account (reached via the ?manager login) is the manager console:
// it keeps the reset tools on the live app AND reads everyone's feedback. Family
// accounts (incl. the owner's personal email) never see these. Must stay in sync
// with the feedback table's RLS admin email (see migration 031).
const MANAGER_EMAIL = 'dev@test.local'

type PushState = 'loading' | 'unsupported' | 'not-installed' | 'default' | 'granted' | 'denied'

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
}

const FEEDBACK_CATEGORY: Record<string, string> = {
  bug: 'תקלה',
  feature: 'רעיון',
  question: 'שאלה',
  other: 'אחר',
}

// Hebrew labels for the pipeline statuses (the DB stores the English keys).
const FEEDBACK_STATUS: Record<string, string> = {
  new: 'חדש', sent: 'נשלח', in_progress: 'בעבודה',
  awaiting_review: 'ממתין לאישור', fixed: 'תוקן', failed: 'נכשל',
}

// Normalise rows from either the full select or the pre-038 fallback select, so the UI
// always has a status (default 'new') and the pipeline fields present.
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
  }))
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [pushState, setPushState] = useState<PushState>('loading')
  const [pushBusy, setPushBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  // Admin inbox editing / creating / sending state.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editAdminNotes, setEditAdminNotes] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [newPath, setNewPath] = useState('')
  const [newShot, setNewShot] = useState<File | null>(null)
  const [sendConfirmId, setSendConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // False until migration 038's columns are live (the fetch fell back) — sending before
  // then would open an issue whose status could never be recorded.
  const [pipelineReady, setPipelineReady] = useState(true)
  // UX-04: inline, auto-dismissing status toast instead of the native blocking alert().
  const [status, setStatus] = useState<string | null>(null)
  function showStatus(msg: string) {
    setStatus(msg)
    setTimeout(() => setStatus(null), 3500)
  }

  const isAdmin = user?.email === MANAGER_EMAIL
  // The feedback inbox + auto-fix pipeline live on the owner's REAL account (not the
  // dev/test manager) — see admin.ts + migration 038.
  const feedbackAdmin = isFeedbackAdmin(user?.email)
  // Technical/debug controls (reset, manual generation re-run) — manager/dev only,
  // never shown to family accounts.
  const showDevTools = import.meta.env.DEV || isAdmin
  // Real provider, not a hardcoded "Google" — magic-link users sign in via email.
  const providerLabel = user?.app_metadata?.provider === 'google' ? 'Google' : 'אימייל'

  const [themePref, setThemePrefState] = useState<ThemePref>(getThemePref())
  function changeTheme(p: ThemePref) { setThemePref(p); setThemePrefState(p) }

  useEffect(() => {
    refreshPushState()
  }, [])

  async function loadFeedback() {
    const full = 'id, email, note, path, category, context, screenshot_path, created_at, status, admin_notes, github_issue_number, github_pr_url'
    const primary = await supabase.from('feedback').select(full).order('created_at', { ascending: false })
    if (!primary.error) { setPipelineReady(true); setFeedback(normalizeFeedback(primary.data)); return }
    // Resilience: pipeline columns (migration 038) or screenshot_path (034) not live yet
    // (schema-cache lag) — fall back to the legacy set so the inbox still loads, and mark
    // the pipeline not-ready so 'Send to Claude' stays disabled until the migration runs.
    if (/status|admin_notes|github_|screenshot_path|column|schema|PGRST204/i.test(primary.error.message ?? '')) {
      setPipelineReady(false)
      const fb = await supabase.from('feedback')
        .select('id, email, note, path, category, context, created_at')
        .order('created_at', { ascending: false })
      setFeedback(normalizeFeedback(fb.data))
    }
  }

  useEffect(() => {
    if (!feedbackAdmin) return
    loadFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackAdmin])

  function viewShot(path: string) {
    // Open the tab synchronously (iOS Safari blocks window.open after an await),
    // then redirect it to the signed URL once it resolves.
    const win = window.open('', '_blank')
    getFeedbackScreenshotSignedUrl(path)
      .then(url => { if (win) win.location.href = url; else window.open(url, '_blank') })
      .catch(() => win?.close())
  }

  async function deleteFeedback(id: string) {
    const removed = feedback.find(f => f.id === id)
    setFeedback(prev => prev.filter(f => f.id !== id))
    const { error } = await supabase.from('feedback').delete().eq('id', id)
    if (error && removed) {
      // Restore the optimistically-removed row so the inbox stays truthful.
      setFeedback(prev => [removed, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)))
      showStatus('מחיקת ההצעה נכשלה — נסו שוב')
    }
  }

  // Save the admin's edits to the description + admin_notes (column-capped by RLS).
  async function saveEdit(id: string) {
    const note = editNote.trim()
    const admin_notes = editAdminNotes.trim() || null
    if (!note) { showStatus('התיאור לא יכול להיות ריק'); return }
    const { error } = await supabase.from('feedback').update({ note, admin_notes }).eq('id', id)
    if (error) { showStatus('שמירת השינוי נכשלה — נסו שוב'); return }
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, note, admin_notes } : f))
    setEditingId(null)
  }

  // Admin creates a feedback item himself (description + optional path + optional shot).
  async function createItem() {
    if (!user || !newNote.trim()) return
    setBusyId('new')
    const ins = await supabase.from('feedback')
      .insert({ owner_id: user.id, email: user.email ?? null, note: newNote.trim(), path: newPath.trim() || null })
      .select('id').single()
    if (ins.error || !ins.data) { setBusyId(null); showStatus('יצירת הפריט נכשלה'); return }
    if (newShot) {
      try {
        const path = await uploadFeedbackScreenshot(newShot, ins.data.id as string, user.id)
        await supabase.from('feedback').update({ screenshot_path: path }).eq('id', ins.data.id as string)
      } catch { /* best-effort — the item is saved without the image */ }
    }
    setBusyId(null); setShowCreate(false); setNewNote(''); setNewPath(''); setNewShot(null)
    loadFeedback()
  }

  // Send an item to the pipeline (opens the GitHub issue via the edge function).
  async function sendToClaude(id: string) {
    setSendConfirmId(null); setBusyId(id)
    const res = await supabase.functions.invoke('send-feedback-to-claude', { body: { feedback_id: id } })
    setBusyId(null)
    if (res.error) {
      // The function returns a Hebrew message (e.g. the one-run-at-a-time block) in its body.
      let msg = 'השליחה נכשלה — נסו שוב'
      try {
        const ctx = (res.error as unknown as { context?: Response }).context
        const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
        if (body?.error) msg = body.error
      } catch { /* keep the generic message */ }
      showStatus(msg)
      return
    }
    loadFeedback()
  }

  async function refreshPushState() {
    if (!pushSupported()) { setPushState('unsupported'); return }
    const perm = Notification.permission
    if (perm === 'denied') { setPushState('denied'); return }
    if (perm === 'granted') {
      setPushState((await isSubscribed()) ? 'granted' : 'default')
      return
    }
    // perm === 'default': on iOS push only works once added to the home screen.
    if (isIOS() && !isInstalledPWA()) { setPushState('not-installed'); return }
    setPushState('default')
  }

  async function enableNotifications() {
    if (!user) return
    setPushBusy(true)
    try {
      await enablePush(user.id)
      setPushState('granted')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'denied') setPushState('denied')
      else showStatus('שגיאה בהפעלת התראות: ' + msg)
    } finally {
      setPushBusy(false)
    }
  }

  async function disableNotifications() {
    setPushBusy(true)
    try {
      await disablePush()
      setPushState('default')
    } catch (e) {
      showStatus('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPushBusy(false)
    }
  }

  async function testNotification() {
    try {
      await sendTestNotification()
    } catch (e) {
      showStatus('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function resetGenerationCache() {
    localStorage.removeItem(GENERATION_KEY)
    resetListCache()
    showStatus('המטמון אופס — הגנרציה החודשית תרוץ מחדש בטעינה הבאה')
  }

  async function resetAllData() {
    if (!user) return
    setResetting(true)
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('owner_id', user.id)

      await supabase.from('transactions').delete().eq('owner_id', user.id)
      await supabase.from('tasks').delete().eq('owner_id', user.id)
      await supabase.from('documents').delete().eq('owner_id', user.id)
      await supabase.from('recurring_items').delete().eq('owner_id', user.id)
      await supabase.from('investment_costs').delete().eq('owner_id', user.id)
      await supabase.from('insurance_policies').delete().eq('owner_id', user.id)
      await supabase.from('contracts').delete().eq('owner_id', user.id)
      await supabase.from('mortgage_tracks').delete().eq('owner_id', user.id)
      await supabase.from('mortgages').delete().eq('owner_id', user.id)
      // loans (monthly + balloon) carry owner_id and a SET NULL property FK, so a
      // property delete leaves them orphaned — clear them explicitly before properties.
      await supabase.from('loans').delete().eq('owner_id', user.id)
      await supabase.from('properties').delete().eq('owner_id', user.id)

      if (docs && docs.length > 0) {
        await supabase.storage.from('documents').remove(docs.map(d => d.storage_path))
      }

      localStorage.removeItem(GENERATION_KEY)
      window.location.reload()
    } catch (e) {
      showStatus('שגיאה: ' + (e instanceof Error ? e.message : String(e)))
      setResetting(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className="page settings-page">
      <div className="page-header settings-header">
        <Link to="/" className="settings-back" aria-label="חזרה למסך הראשי"><ArrowRight size={20} /></Link>
        <h1>הגדרות</h1>
      </div>

      <div className="settings-sections">
        <section className="settings-section">
          <h2>חשבון</h2>
          <div className="settings-row">
            <span className="settings-label">אימייל</span>
            <span className="settings-value">{user?.email ?? '—'}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">ספק</span>
            <span className="settings-value">{providerLabel}</span>
          </div>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={signOut}>יציאה מהחשבון</button>
          </div>
        </section>

        <section className="settings-section">
          <h2>מראה</h2>
          <p className="settings-note">בחרו מצב תצוגה. "לפי המכשיר" יתחלף אוטומטית בין יום ללילה לפי הגדרות הטלפון.</p>
          <div className="toggle-group" style={{ marginTop: 6 }}>
            <button type="button" className={`toggle-btn${themePref === 'light' ? ' active' : ''}`} onClick={() => changeTheme('light')}>בהיר</button>
            <button type="button" className={`toggle-btn${themePref === 'dark' ? ' active' : ''}`} onClick={() => changeTheme('dark')}>כהה</button>
            <button type="button" className={`toggle-btn${themePref === 'system' ? ' active' : ''}`} onClick={() => changeTheme('system')}>לפי המכשיר</button>
          </div>
        </section>

        <section className="settings-section">
          <h2>התראות</h2>
          <p className="settings-note">
            קבלו התראה לנייד כשמשהו דורש טיפול — אישור גביית שכר דירה, תשלומים, חידוש חוזה ומשימות שעבר זמנן. נשלחת פעם ביום, רק כשיש משהו ממתין.
          </p>
          {pushState === 'unsupported' && (
            <p className="settings-note">הדפדפן הזה לא תומך בהתראות.</p>
          )}
          {pushState === 'not-installed' && (
            <p className="settings-note">
              כדי לקבל התראות ב-iPhone צריך קודם להוסיף את האפליקציה למסך הבית (שיתוף ← הוסף למסך הבית) ולפתוח אותה משם.
            </p>
          )}
          {pushState === 'denied' && (
            <p className="settings-note">
              ההתראות חסומות. ניתן לאפשר אותן מחדש בהגדרות המכשיר עבור האפליקציה.
            </p>
          )}
          {pushState === 'default' && !pushConfigured() && (
            <p className="settings-note">ההתראות יופעלו בקרוב.</p>
          )}
          {pushState === 'granted' ? (
            <div className="settings-actions" style={{ alignItems: 'center', gap: 12 }}>
              <span className="settings-value" style={{ color: 'var(--success-text, #1a7f37)', fontWeight: 600 }}>מופעל ✓</span>
              <button className="btn-secondary" onClick={testNotification} disabled={pushBusy}>
                שלח התראת בדיקה
              </button>
              <button className="btn-secondary" onClick={disableNotifications} disabled={pushBusy}>
                {pushBusy ? '...' : 'כבה'}
              </button>
            </div>
          ) : pushState === 'default' && pushConfigured() ? (
            <div className="settings-actions">
              <button className="btn-secondary" onClick={enableNotifications} disabled={pushBusy}>
                {pushBusy ? 'מפעיל...' : 'הפעל התראות'}
              </button>
            </div>
          ) : null}
        </section>

        <InstallGuide />

        {GOOGLE_TASKS_ENABLED && (
        <section className="settings-section">
          <h2>סנכרון Google Tasks</h2>
          <p className="settings-note">
            סנכרון דו-כיווני עם רשימת &quot;apartment&quot; ב-Google Tasks. הטוקן תקף כשעה אחרי ההתחברות — אם הסנכרון נפסק, יש להתחבר מחדש.
          </p>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={() => { resetListCache(); showStatus('מטמון רשימת Google אופס') }}>
              אפס מטמון רשימה
            </button>
          </div>
        </section>
        )}

        {showDevTools && (
        <section className="settings-section">
          <h2>גנרציה חודשית</h2>
          <p className="settings-note">
            הגנרציה החודשית יוצרת עסקאות ומשימות מפריטים קבועים ומתריעה על חידושי חוזה. רצה אוטומטית פעם בחודש.
          </p>
          <div className="settings-actions">
            <button className="btn-secondary" onClick={resetGenerationCache}>
              הרץ שוב חודש זה
            </button>
          </div>
        </section>
        )}

        {feedbackAdmin && (
          <section className="settings-section">
            <div className="settings-fb-head">
              <h2>הצעות ותקלות {feedback.length > 0 && `(${feedback.length})`}</h2>
              <button type="button" className="settings-fb-new" onClick={() => setShowCreate(v => !v)}>
                {showCreate ? 'סגור' : '+ פריט חדש'}
              </button>
            </div>

            {showCreate && (
              <div className="settings-fb-create">
                <textarea rows={3} placeholder="תיאור התקלה או הרעיון — הופך לכותרת+גוף ה-issue" value={newNote} onChange={e => setNewNote(e.target.value)} />
                <input type="text" placeholder="נתיב/מסך (אופציונלי)" value={newPath} onChange={e => setNewPath(e.target.value)} />
                <label className="settings-fb-shotpick">
                  <Camera size={14} weight="duotone" /> {newShot ? newShot.name : 'צירוף צילום מסך (אופציונלי)'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewShot(e.target.files?.[0] ?? null)} />
                </label>
                <div className="settings-fb-rowactions">
                  <button className="btn-secondary" onClick={() => { setShowCreate(false); setNewNote(''); setNewPath(''); setNewShot(null) }}>ביטול</button>
                  <button className="btn-primary" onClick={createItem} disabled={!newNote.trim() || busyId === 'new'}>{busyId === 'new' ? 'שומר…' : 'צור פריט'}</button>
                </div>
              </div>
            )}

            {feedback.length === 0 ? (
              <p className="settings-note">עדיין אין פריטים.</p>
            ) : (
              <div className="settings-feedback-list">
                {feedback.map(f => {
                  const editing = editingId === f.id
                  const canSend = f.status === 'new' || f.status === 'failed'
                  const lockedByOther = feedback.some(o => o.id !== f.id && (o.status === 'sent' || o.status === 'in_progress'))
                  return (
                    <div key={f.id} className="settings-feedback-row">
                      <div className="settings-fb-toprow">
                        <span className={`settings-fb-status status-${f.status}`}>{FEEDBACK_STATUS[f.status] ?? f.status}</span>
                        {f.category && <span className={`settings-feedback-cat cat-${f.category}`}>{FEEDBACK_CATEGORY[f.category] ?? f.category}</span>}
                      </div>

                      {editing ? (
                        <>
                          <textarea className="settings-fb-edit" rows={3} value={editNote} onChange={e => setEditNote(e.target.value)} />
                          <textarea className="settings-fb-edit" rows={2} placeholder="הערות שלך ל-Claude (לפני שליחה)…" value={editAdminNotes} onChange={e => setEditAdminNotes(e.target.value)} />
                          <div className="settings-fb-rowactions">
                            <button className="btn-secondary" onClick={() => setEditingId(null)}>ביטול</button>
                            <button className="btn-primary" onClick={() => saveEdit(f.id)}>שמור</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="settings-feedback-note">{f.note}</p>
                          {f.admin_notes && <p className="settings-fb-adminnote">הערה: {f.admin_notes}</p>}
                        </>
                      )}

                      {f.screenshot_path && (
                        <button type="button" className="settings-feedback-shot" onClick={() => viewShot(f.screenshot_path!)}>
                          <Camera size={13} weight="duotone" /> צילום מצורף
                        </button>
                      )}

                      <div className="settings-feedback-meta">
                        <span>{(f.path || f.context) && <span className="settings-feedback-screen">{screenLabel(f.path)}{f.context ? ` · ${f.context}` : ''}</span>}{f.email ?? '—'} · {new Date(f.created_at).toLocaleDateString('he-IL')}</span>
                      </div>

                      {!editing && (
                        <div className="settings-fb-actions">
                          {f.github_pr_url && (
                            <a className="settings-fb-pr" href={f.github_pr_url} target="_blank" rel="noreferrer"><ArrowSquareOut size={13} /> בקשת-מיזוג</a>
                          )}
                          <button className="settings-fb-editbtn" onClick={() => { setEditingId(f.id); setEditNote(f.note); setEditAdminNotes(f.admin_notes ?? '') }}>עריכה</button>
                          {canSend && (
                            <button
                              className="settings-fb-send"
                              disabled={lockedByOther || busyId === f.id || !pipelineReady}
                              title={!pipelineReady ? 'המערכת עדיין לא מוכנה — יש להריץ את המיגרציה ולפרוס את הפונקציות' : lockedByOther ? 'יש פריט אחר בתהליך — יש להמתין לסיומו' : 'שליחה ל-Claude לתיקון'}
                              onClick={() => setSendConfirmId(f.id)}
                            >
                              <PaperPlaneTilt size={13} weight="fill" /> {busyId === f.id ? 'שולח…' : 'שלח ל-Claude'}
                            </button>
                          )}
                          <button className="settings-feedback-del" onClick={() => deleteFeedback(f.id)} aria-label="מחק">✕</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <ConfirmDialog
              open={sendConfirmId !== null}
              title="לשלוח ל-Claude?"
              message="ייפתח issue בגיטהאב ו-Claude יתחיל לתקן ולפתוח בקשת-מיזוג. אפשר פריט אחד בכל פעם."
              confirmLabel="שלח"
              onConfirm={() => sendConfirmId && sendToClaude(sendConfirmId)}
              onCancel={() => setSendConfirmId(null)}
            />
          </section>
        )}

        {showDevTools && (
        <section className="settings-section">
          <h2>פיתוח ובדיקה</h2>
          <p className="settings-note">
            מחיקת כל הנתונים ופתיחת מחדש של אשף הקליטה — שימושי לבדיקת הונבורדינג מחדש.
          </p>
          <div className="settings-actions">
            {!confirmReset ? (
              <button className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setConfirmReset(true)}>
                איפוס כל הנתונים
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>בטוח? כל הנתונים יימחקו.</span>
                <button className="btn-secondary" onClick={() => setConfirmReset(false)} disabled={resetting}>ביטול</button>
                <button className="btn-primary" style={{ background: 'var(--danger)' }} onClick={resetAllData} disabled={resetting}>
                  {resetting ? 'מאפס...' : 'מחק הכול'}
                </button>
              </div>
            )}
          </div>
        </section>
        )}
      </div>

      {status && <div className="settings-toast" role="status" aria-live="polite">{status}</div>}
    </div>
  )
}
