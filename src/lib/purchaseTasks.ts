// The checklist that carries a buyer from signing to handover.
//
// The app already has everything needed to be useful in this stage — tasks carry a date,
// surface in the home's action centre, and go out in the daily push. What was missing was
// the tasks themselves (owner: "there are many tasks along the way").
//
// Two rules govern what's here, both from docs/specs/onboarding.md:
//
//  1. Nothing is seeded without a date anchor. An undated task is ALWAYS visible on the
//     home (homeTasks.ts), so seeding a pile of them would produce exactly the daunting
//     to-do list this is meant to avoid. Anchored, the same seven spread across months and
//     one or two are visible at a time.
//
//  2. We never invent a deadline. Purchase tax and the instalments to the seller carry
//     legal and contractual dates that differ per deal and that we do not know, so they
//     become ONE undated task asking the owner to set them from their own contract — the
//     single deliberate exception to rule 1, and the one thing worth seeing on day one.

export type SeedTask = {
  title: string
  /** null only for the deliberate exception above. */
  due_date: string | null
  category: string
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString().slice(0, 10)
}

/**
 * The plan for one handover date. `today` clamps anchors that already passed: a buyer
 * who signs up eight weeks before handover should see "find a tenant" as due now, not as
 * two weeks overdue on a task they were never given.
 */
export function purchaseTaskPlan(keyDate: string, today: string): SeedTask[] {
  const at = (daysBefore: number) => {
    const d = shift(keyDate, -daysBefore)
    return d < today ? today : d
  }

  return [
    {
      title: 'לקבוע את מועדי התשלום מהחוזה',
      due_date: null,
      category: 'כללי',
    },
    { title: 'להתחיל לחפש שוכר', due_date: at(60), category: 'כללי' },
    { title: 'להשלים ביטוח מבנה וביטוח חיים', due_date: at(45), category: 'כללי' },
    { title: 'לבצע את המשכנתא מול הבנק', due_date: at(30), category: 'כללי' },
    { title: 'להכין חוזה שכירות', due_date: at(30), category: 'כללי' },
    { title: 'בדיקת ליקויים לקראת המסירה', due_date: at(14), category: 'ביקור ובדיקה' },
    { title: 'להעביר חשמל, מים, ארנונה וועד בית על שמכם', due_date: at(0), category: 'כללי' },
  ]
}

/** Titles used to detect a plan already added, so the invitation appears exactly once. */
export const PURCHASE_TASK_TITLES: string[] = purchaseTaskPlan('2000-01-01', '1900-01-01')
  .map((t) => t.title)
