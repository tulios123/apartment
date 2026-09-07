import { useMemo, useState } from 'react'
import { Key, PencilSimple } from '@phosphor-icons/react'
import type { Contract, Loan, MortgageTrack, Property } from '../../types'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { updateProperty } from '../../hooks/usePropertyData'
import { userErrorMessage } from '../../lib/errorHe'
import { monthlyVirtualEntries } from '../../lib/projections'
import { countdownLabel } from '../../lib/stage'
import { daysBetween, formatCurrency, formatDate, formatNum, formatSignedCurrency, parseLocalISO, sanitizeAmountInt } from '../../lib/format'
import { Skeleton } from '../../components/ui/Skeleton'

type Policy = { monthly_premium: number | null; start_date: string | null; end_date: string | null }

/**
 * The home's headline card while the owner is still waiting for the keys.
 *
 * It replaces "צפי לסוף החודש", which is correct arithmetic on the wrong clock for this
 * person: with no lease and a mortgage that starts at handover, their month genuinely
 * totals ₪0, and a money app whose biggest number is zero says nothing. Their life is
 * not divided into months yet — it runs to a date.
 *
 * The brief (owner, 07.09) is certainty: when it ends, how much is already in, and what
 * it will cost once it starts. Certainty is not optimism — every figure here is the real
 * one, and the first payment comes from the same grace-aware engine the ledger uses
 * rather than a second calculation that could drift from it.
 */
export function PreKeyCard({ property, tracks, loans, policies, contracts, today }: {
  property: Property
  tracks: MortgageTrack[]
  loans: Loan[]
  policies: Policy[]
  contracts: Contract[]
  today: string
}) {
  // Only mounted for a pre-key account, so the fetch this hook makes never runs for
  // everyone else's home.
  const { totalInvested, loading: loadingInvested } = useInvestmentData()

  // The column arrives in migration 049. usePropertyData selects '*', so until it is
  // applied the key is simply absent — and the field lights up by itself, with no
  // deploy, the moment the migration runs.
  const supportsExpectedRent = 'expected_monthly_rent' in property
  const [rent, setRent] = useState<number>(Number(property.expected_monthly_rent) || 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const expectedRent = rent

  function startEdit() {
    setDraft(expectedRent > 0 ? String(expectedRent) : '')
    setSaveError(null)
    setEditing(true)
  }

  async function save() {
    const next = parseInt(draft, 10) || 0
    setEditing(false)
    if (next === expectedRent) return
    // Optimistic: the point of the lever is that the balance moves as you type, so the
    // number updates immediately and rolls back only if the write actually fails.
    const previous = expectedRent
    setRent(next)
    setSaving(true)
    try {
      await updateProperty(property.id, { expected_monthly_rent: next || null })
    } catch (e) {
      setRent(previous)
      setSaveError(userErrorMessage(e, 'השמירה נכשלה — נסו שוב'))
    } finally {
      setSaving(false)
    }
  }

  const keyDate = property.key_delivery_date!
  const daysLeft = daysBetween(today, keyDate)

  // Progress from signing to handover — the one thing that visibly moves while waiting.
  const progressPct = useMemo(() => {
    const from = property.purchase_date
    if (!from) return null
    const total = daysBetween(from, keyDate)
    if (total <= 0) return null
    return Math.max(0, Math.min(100, (daysBetween(from, today) / total) * 100))
  }, [property.purchase_date, keyDate, today])

  // What the first real month costs. Same engine as the ledger and the month forecast
  // (grace-aware, schedule-bounded), asked about the handover month instead of this one.
  const firstPayment = useMemo(() => {
    const d = parseLocalISO(keyDate)
    return monthlyVirtualEntries(contracts, tracks, d.getFullYear(), d.getMonth() + 1, loans, policies)
      .filter(e => e.direction === 'expense')
      .reduce((s, e) => s + e.amount, 0)
  }, [contracts, tracks, loans, policies, keyDate])

  return (
    <div className="hs-flow-card">
      <div className="hs-flow-headline">
        <span className="hs-flow-headline-label">
          <Key size={15} weight="duotone" /> מסירת המפתח
        </span>
        <span className="hs-flow-headline-value">{countdownLabel(daysLeft)}</span>
      </div>
      <div className="hs-milestone-date">{formatDate(keyDate)}</div>

      {progressPct != null && (
        <div className="hs-track hs-milestone-track">
          <div className="hs-track-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className="hs-flow-line">
        <div className="hs-flow-line-top">
          <span className="hs-flow-name">כבר הושקע</span>
          {loadingInvested
            ? <Skeleton width={80} height={16} />
            : <span className="hs-flow-amt">{formatCurrency(totalInvested)}</span>}
        </div>
      </div>

      {firstPayment > 0 && (
        <div className="hs-flow-line">
          <div className="hs-flow-line-top">
            <span className="hs-flow-name">
              התשלום החודשי הראשון
              <span className="hs-chip auto">מ־{formatDate(keyDate)}</span>
            </span>
            <span className="hs-flow-amt muted out">{formatCurrency(firstPayment)}</span>
          </div>
        </div>
      )}

      {/* The lever. One number the buyer usually knows, and the only thing standing
          between the mortgage engine and the answer they actually want. Editable right
          here, beside its own result, because it moves the balance a lot. */}
      {supportsExpectedRent && (
        <div className="hs-flow-line">
          <div className="hs-flow-line-top">
            <span className="hs-flow-name">שכר דירה צפוי</span>
            {editing ? (
              <input
                className="hs-prekey-rent-input"
                type="text" inputMode="numeric" autoFocus
                aria-label="שכר דירה חודשי צפוי"
                value={formatNum(draft)}
                onChange={e => setDraft(sanitizeAmountInt(e.target.value))}
                onBlur={save}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
              />
            ) : (
              <button type="button" className="hs-prekey-rent-btn" onClick={startEdit} disabled={saving}>
                {expectedRent > 0 ? formatCurrency(expectedRent) : 'להזנה'}
                <PencilSimple size={13} weight="bold" />
              </button>
            )}
          </div>
          {expectedRent > 0 && firstPayment > 0 && (
            <div className="hs-flow-line-top" style={{ marginTop: 8 }}>
              <span className="hs-flow-name">המאזן החודשי אז</span>
              {/* Certainty is not optimism: a negative balance is shown, not softened. */}
              <span className={`hs-flow-amt${expectedRent - firstPayment >= 0 ? ' income' : ' out'}`}>
                {formatSignedCurrency(expectedRent - firstPayment)}
              </span>
            </div>
          )}
          {saveError && <span className="hs-addlease-sub" role="alert">{saveError}</span>}
        </div>
      )}

      <p className="hs-flow-note">
        {expectedRent > 0
          ? 'שכר הדירה הוא הערכה שלכם — שנו אותו וראו איך המאזן זז. ההכנסה תתחיל אחרי מסירת המפתח.'
          : 'ההכנסה מהשכירות תתחיל אחרי מסירת המפתח. עד אז אין תשלומים חודשיים לעקוב אחריהם.'}
      </p>
    </div>
  )
}
