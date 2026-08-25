import { supabase } from '../../lib/supabase'
import type { TrackDraft, LoanDraft, PolicyDraft, BalloonRow, ExtraCost } from './types'
import type { Property, Contract, MortgageTrack, Loan, InsurancePolicy, InvestmentCost } from '../../types'

/**
 * Everything the wizard needs in order to EDIT an account that already has data,
 * instead of starting blank and inserting a second copy of everything on finish
 * (owner, 26.07). Every row keeps its `id`, so finish updates in place.
 *
 * Only sections that actually exist are returned; a genuine first run yields
 * `null` and the wizard behaves exactly as before (local draft, all inserts).
 */
export type Hydrated = {
  propertyId: string
  buyerName: string; street: string; city: string; rooms: string
  purchasePrice: string; signingDate: string; keyDeliveryDate: string
  propertySizeSqm: string; floorNumber: string
  tracks: TrackDraft[]
  loans: LoanDraft[]
  balloonLoans: BalloonRow[]
  policies: PolicyDraft[]
  contractId: string | null
  companyName: string; startDate: string; endDate: string; monthlyRent: string
  rentPaymentMethod: 'check' | 'bank_transfer'; addRentReminder: boolean
  equityValue: string; equityCostId: string | null
  costs: { lawyer: string; brokerage: string; mortgage_advisor: string; investment_company: string; appraiser: string }
  costIds: Record<string, string>
  extraCosts: ExtraCost[]
}

const s = (v: unknown): string => (v == null ? '' : String(v))

/** "רחוב 10, עיר" → { street: 'רחוב 10', city: 'עיר' }. Splits on the LAST comma so a
 *  street containing a comma survives; a comma-less address is treated as the street. */
function splitAddress(address: string | null): { street: string; city: string } {
  const a = (address ?? '').trim()
  const i = a.lastIndexOf(',')
  if (i < 0) return { street: a, city: '' }
  return { street: a.slice(0, i).trim(), city: a.slice(i + 1).trim() }
}

function trackToDraft(t: MortgageTrack): TrackDraft {
  return {
    id: t.id,
    track_type: t.track_type,
    principal: s(t.principal),
    annual_rate: s(t.annual_rate),
    prime_rate: s(t.prime_rate),
    margin: s(t.margin),
    term_months: s(t.term_months),
    grace_months: s(t.grace_months ?? ''),
    start_date: s(t.start_date),
  }
}

function loanToDraft(l: Loan): LoanDraft {
  return {
    id: l.id,
    repayment_type: l.repayment_type,
    track_type: l.track_type ?? 'fixed_unlinked',
    label: s(l.label),
    lender: s(l.lender),
    principal: s(l.principal),
    annual_rate: s(l.annual_rate),
    prime_rate: s(l.prime_rate),
    margin: s(l.margin),
    term_months: s(l.term_months),
    grace_months: s(l.grace_months ?? ''),
    start_date: s(l.start_date),
  }
}

/** The named cost rows the wizard shows as its own fields; anything else is "extra". */
const NAMED_COSTS = ['lawyer', 'brokerage', 'mortgage_advisor', 'investment_company', 'appraiser'] as const

export async function hydrateFromAccount(userId: string): Promise<Hydrated | null> {
  const { data: props } = await supabase.from('properties').select('*').eq('owner_id', userId).limit(1)
  const property = (props?.[0] ?? null) as Property | null
  if (!property) return null

  // Contracts: the wizard edits ONE rental contract, so take the most recent — that's
  // the one its fields describe. Older contracts are history and stay untouched.
  const [tracksRes, loansRes, policiesRes, contractsRes, costsRes] = await Promise.all([
    supabase.from('mortgage_tracks').select('*').eq('owner_id', userId),
    supabase.from('loans').select('*').eq('owner_id', userId),
    supabase.from('insurance_policies').select('*').eq('owner_id', userId),
    supabase.from('contracts').select('*').eq('owner_id', userId).order('start_date', { ascending: false }).limit(1),
    supabase.from('investment_costs').select('*').eq('owner_id', userId),
  ])

  const allLoans = (loansRes.data ?? []) as Loan[]
  const contract = (contractsRes.data?.[0] ?? null) as Contract | null
  const costs = (costsRes.data ?? []) as InvestmentCost[]
  const { street, city } = splitAddress(property.address)

  const named = { lawyer: '', brokerage: '', mortgage_advisor: '', investment_company: '', appraiser: '' }
  const costIds: Record<string, string> = {}
  const extraCosts: ExtraCost[] = []
  let equityValue = ''
  let equityCostId: string | null = null
  for (const c of costs) {
    if (c.category === 'self_equity') { equityValue = s(c.amount); equityCostId = c.id; continue }
    if ((NAMED_COSTS as readonly string[]).includes(c.category)) {
      named[c.category as keyof typeof named] = s(c.amount)
      costIds[c.category] = c.id
      continue
    }
    extraCosts.push({ id: c.id, name: s(c.label), amount: s(c.amount) })
  }

  return {
    propertyId: property.id,
    buyerName: s(property.buyer_name),
    street, city,
    rooms: s(property.rooms),
    purchasePrice: s(property.purchase_price),
    signingDate: s(property.purchase_date),
    keyDeliveryDate: s(property.key_delivery_date),
    propertySizeSqm: s(property.property_size_sqm),
    floorNumber: s(property.floor),
    tracks: ((tracksRes.data ?? []) as MortgageTrack[]).map(trackToDraft),
    loans: allLoans.filter(l => l.repayment_type !== 'balloon').map(loanToDraft),
    balloonLoans: allLoans.filter(l => l.repayment_type === 'balloon')
      .map(l => ({ id: l.id, amount: s(l.principal), lender: s(l.lender) })),
    policies: ((policiesRes.data ?? []) as InsurancePolicy[]).map(p => ({
      id: p.id,
      type: s(p.type),
      company: s(p.company),
      monthly_premium: s(p.monthly_premium),
      start_date: s(p.start_date),
      end_date: s(p.end_date),
    })),
    contractId: contract?.id ?? null,
    companyName: s(contract?.company_name),
    startDate: s(contract?.start_date),
    endDate: s(contract?.end_date),
    monthlyRent: s(contract?.monthly_rent),
    rentPaymentMethod: contract?.payment_method === 'check' ? 'check' : 'bank_transfer',
    addRentReminder: contract?.requires_approval ?? true,
    equityValue, equityCostId,
    costs: named,
    costIds,
    extraCosts,
  }
}
