// Staging-only test scenarios.
//
// The owner cannot see the pre-key screens on his own account — it holds a leased
// apartment — and building a separate test environment for a repo with ONE Supabase
// project would be slow and fragile. So instead: a button that loads a coherent set of
// data into the signed-in account, and lets the app derive the stage from it exactly as
// it will for a real user (src/lib/stage.ts).
//
// Deliberately data, not a mode switch. A "force the screen into pre-key state" toggle
// would be a second code path — it can look perfect while the real derivation is broken,
// and it would show the new screen with none of the numbers that are its whole point.
//
// Safety: this wipes the signed-in account. It is gated to staging + a manager account in
// the UI, and every write here is scoped to the passed userId. Staging and production
// share one database (both deploy workflows pass the same VITE_SUPABASE_URL), so nothing
// in this file may ever address a row by anything but the current owner_id.

import type { SupabaseClient } from '@supabase/supabase-js'
import { monthDayISO, parseLocalISO } from './format'

export type ScenarioId = 'purchase_process' | 'handover_soon' | 'keys_no_tenant' | 'leased'

export const SCENARIOS: { id: ScenarioId; label: string; hint: string }[] = [
  { id: 'purchase_process', label: 'תהליך רכישה', hint: 'חוזה נחתם, המפתח בעוד 7 חודשים' },
  { id: 'handover_soon', label: 'מסירה בעוד שבועיים', hint: 'הקצה הצפוף — כשכל הרשימה מתכנסת' },
  { id: 'keys_no_tenant', label: 'יש מפתח, אין שוכר', hint: 'נמסרה אתמול — כולל רגע המסירה' },
  { id: 'leased', label: 'מושכרת', hint: 'המצב הרגיל — שוכר בפנים' },
]

/** Shift an ISO date by whole months, keeping the day where the target month allows. */
export function addMonths(iso: string, months: number): string {
  const d = parseLocalISO(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  // Clamp into the target month (31 Jan + 1 month must not spill into March).
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return monthDayISO(d)
}

/** Shift an ISO date by whole days. */
export function shiftDays(iso: string, days: number): string {
  const d = parseLocalISO(iso)
  d.setDate(d.getDate() + days)
  return monthDayISO(d)
}

export type ScenarioData = {
  property: Record<string, unknown>
  tracks: Record<string, unknown>[]
  costs: Record<string, unknown>[]
  contract: Record<string, unknown> | null
  /** The rent approval item a real leased account carries (created by the app's own sync). */
  rentItem: Record<string, unknown> | null
}

/**
 * The rows a scenario puts in the account, as pure data so the shapes stay testable
 * without a database. `today` is passed in for the same reason.
 */
export function scenarioData(id: ScenarioId, today: string): ScenarioData {
  // One apartment, one story, four points along it — so switching scenarios changes the
  // stage without changing the flat, and the screens stay comparable.
  const price = 1_850_000
  const signing = addMonths(today, -2)
  const rent = 5_200

  // Handover: ahead for the two waiting stages, behind for the two later ones. The
  // near date is what makes the checklist's clamping visible — every anchor that has
  // already passed collapses onto today instead of arriving overdue.
  const keyDelivery = id === 'purchase_process' ? addMonths(today, 7)
    : id === 'handover_soon' ? shiftDays(today, 14)
    // Yesterday, not last month: inside the handover greeting's window, so this one
    // scenario shows both the moment itself and the settled no-tenant state behind it.
    : id === 'keys_no_tenant' ? shiftDays(today, -1)
    : addMonths(today, -1)

  const property = {
    address: 'הרצל 45, תל אביב',
    buyer_name: 'חשבון בדיקות',
    purchase_price: price,
    purchase_date: signing,
    key_delivery_date: keyDelivery,
    property_size_sqm: 68,
    floor: 4,
    rooms: 3,
    estimated_value: price,
    notes: 'נתוני דוגמה — נטענו מתוך אזור הבדיקות',
  }

  // Tracks start at handover, which is what the wizard already defaults them to. Before
  // that date the schedule-bounded forecast correctly shows no payment yet.
  const tracks = [
    {
      label: 'פריים', track_type: 'prime', principal: 600_000,
      annual_rate: 5.5, prime_rate: 6, margin: -0.5,
      term_months: 240, grace_months: 0, start_date: keyDelivery,
    },
    {
      label: 'קבועה לא צמודה', track_type: 'fixed_unlinked', principal: 550_000,
      annual_rate: 4.2, prime_rate: null, margin: null,
      term_months: 300, grace_months: 0, start_date: keyDelivery,
    },
  ]

  const costs = [
    { category: 'self_equity', label: null, amount: 700_000 },
    { category: 'lawyer', label: null, amount: 12_000 },
    { category: 'brokerage', label: null, amount: 39_000 },
  ]

  // Only the leased scenario carries a live contract. The others differ from it only in
  // that, which is exactly the distinction the screens must handle.
  const contract = id === 'leased'
    ? {
        company_name: 'דנה לוי',
        start_date: addMonths(today, -1),
        end_date: addMonths(today, 11),
        monthly_rent: rent,
        deposit: rent,
        payment_method: 'check',
        requires_approval: true,
        renewal_alert_days: [60, 30],
      }
    : null

  const rentItem = id === 'leased'
    ? {
        direction: 'income',
        amount: rent,
        category: 'שכר דירה',
        day_of_month: Number(addMonths(today, -1).slice(8, 10)),
        start_date: addMonths(today, -1),
        end_date: addMonths(today, 11),
        payee: 'דנה לוי',
        execution_type: 'requires_approval',
        payment_method: 'check',
        renewal_alert_days: [60, 30],
      }
    : null

  return { property, tracks, costs, contract, rentItem }
}

/** Every table a scenario touches, in an order that respects the foreign keys.
 *  Mirrors the wipe in Settings' "איפוס כל הנתונים" (R14: check every step). */
const WIPE_ORDER = [
  'transactions', 'tasks', 'documents', 'recurring_items', 'investment_costs',
  'insurance_policies', 'contracts', 'mortgage_tracks', 'mortgages', 'loans', 'properties',
]

/**
 * Replace the signed-in account's data with a scenario. Throws on the first failure,
 * leaving the account inspectable rather than half-wiped and silently wrong.
 */
export async function applyScenario(
  supabase: SupabaseClient,
  userId: string,
  id: ScenarioId,
  today: string,
): Promise<void> {
  const data = scenarioData(id, today)

  for (const table of WIPE_ORDER) {
    const { error } = await supabase.from(table).delete().eq('owner_id', userId)
    if (error) throw new Error(`מחיקת ${table} נכשלה — ${error.message}`)
  }

  const ins = async <T,>(table: string, row: Record<string, unknown>): Promise<T> => {
    const { data: created, error } = await supabase
      .from(table).insert({ ...row, owner_id: userId }).select().single()
    if (error) throw new Error(`יצירת ${table} נכשלה — ${error.message}`)
    return created as T
  }

  const property = await ins<{ id: string }>('properties', data.property)
  const mortgage = await ins<{ id: string }>('mortgages', {
    property_id: property.id, lender: 'בנק לאומי', notes: null,
  })

  for (const track of data.tracks) {
    await ins('mortgage_tracks', { ...track, mortgage_id: mortgage.id })
  }
  for (const cost of data.costs) {
    await ins('investment_costs', cost)
  }

  if (data.contract) {
    const contract = await ins<{ id: string }>('contracts', {
      ...data.contract, property_id: property.id,
    })
    if (data.rentItem) {
      await ins('recurring_items', { ...data.rentItem, contract_id: contract.id })
    }
  }
}
