import { useEffect, useState } from 'react'
import { ListChecks, CaretLeft } from '@phosphor-icons/react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { createTask } from '../../hooks/useTasks'
import { userErrorMessage } from '../../lib/errorHe'
import { purchaseTaskPlan, PURCHASE_TASK_TITLES } from '../../lib/purchaseTasks'

/**
 * Offers the handover checklist to a buyer who doesn't have it yet.
 *
 * An invitation rather than automatic seeding: dropping seven rows into someone's account
 * unasked is the same mistake as the wizard demanding thirty fields up front, and the
 * whole brief here was to keep the stage calm. One tap, and the tasks the app already
 * knows how to surface and remind about exist.
 *
 * Shown exactly once — once any task from the plan exists (open or done) the offer is
 * gone, which also means a buyer who works through the list never sees it return.
 */
export function PreKeyTaskInvite({ keyDate, today, propertyId, onSeeded }: {
  keyDate: string
  today: string
  propertyId: string | null
  onSeeded: () => void
}) {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!user) return
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .in('title', PURCHASE_TASK_TITLES)
      .then(({ count, error: err }) => {
        // On a failed check, stay quiet rather than risk offering a duplicate list.
        if (alive) setShow(!err && (count ?? 0) === 0)
      })
    return () => { alive = false }
  }, [user])

  if (!show) return null

  const plan = purchaseTaskPlan(keyDate, today)

  async function add() {
    setBusy(true)
    setError(null)
    try {
      for (const t of plan) {
        await createTask({
          property_id: propertyId,
          recurring_item_id: null,
          transaction_id: null,
          title: t.title,
          due_date: t.due_date,
          due_time: null,
          category: t.category,
          status: 'open',
          source: 'manual',
          is_recurring: false,
          recurrence_days: null,
        })
      }
      setShow(false)
      onSeeded()
    } catch (e) {
      setError(userErrorMessage(e, 'הוספת המשימות נכשלה — נסו שוב'))
      setBusy(false)
    }
  }

  return (
    <div className="hs-prekey-invite">
      <span className="hs-addlease-icon"><ListChecks size={20} weight="duotone" /></span>
      <span className="hs-addlease-text">
        <span className="hs-addlease-title">{plan.length} דברים לסדר עד המסירה</span>
        <span className="hs-addlease-sub">
          ביטוח, ביצוע המשכנתא, בדיקת ליקויים, שוכר — נזכיר לכם כשכל אחד מגיע
        </span>
        {error && <span className="hs-addlease-sub" role="alert">{error}</span>}
      </span>
      <button type="button" className="hs-addlease-cta" onClick={add} disabled={busy}>
        {busy ? 'מוסיף…' : <>הוסיפו למשימות <CaretLeft size={13} weight="bold" /></>}
      </button>
    </div>
  )
}
