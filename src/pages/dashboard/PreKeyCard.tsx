import { useMemo } from 'react'
import { Key } from '@phosphor-icons/react'
import type { Contract, Loan, MortgageTrack, Property } from '../../types'
import { useInvestmentData } from '../../hooks/useInvestmentData'
import { monthlyVirtualEntries } from '../../lib/projections'
import { countdownLabel } from '../../lib/stage'
import { daysBetween, formatCurrency, formatDate, parseLocalISO } from '../../lib/format'
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

      <p className="hs-flow-note">
        ההכנסה מהשכירות תתחיל אחרי מסירת המפתח. עד אז אין תשלומים חודשיים לעקוב אחריהם.
      </p>
    </div>
  )
}
