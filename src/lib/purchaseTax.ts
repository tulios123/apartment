// מס רכישה — the one cost in the whole purchase the app can compute exactly.
//
// The owner (09.09) asked for it: "כן, שיחשב לבד. ושישאל דירה יחידה או השקעה." It is worth
// computing rather than asking because it is the only cost fixed by law, it is the cost
// people get wrong, and it carries a legal deadline the app already knows how to derive
// (30 days to report, 60 to pay, both from the SIGNING date — see docs/specs/purchase-process.md).
//
// Brackets for 2026, confirmed against two independent sources. The Arrangements Law froze
// the annual indexation, so these hold until 15.01.2028 — after that they must be rechecked:
//   https://doron-aharoni.com/מדרגות-מס-רכישה-2026/
//   https://www.bizportal.co.il/realestates/news/article/20038028
//
// The official calculator stays the last word, and the UI says so:
//   https://www.misim.gov.il/svsimurechisha/FrmFirstPage.aspx

/** [threshold up to which this rate applies, rate]. Infinity closes the ladder. */
const SINGLE: [number, number][] = [
  [1_978_745, 0],
  [2_347_040, 0.035],
  [6_055_070, 0.05],
  [20_183_565, 0.08],
  [Infinity, 0.10],
]

const ADDITIONAL: [number, number][] = [
  [6_055_070, 0.08],
  [Infinity, 0.10],
]

/** The date the frozen brackets stop being trustworthy. */
export const BRACKETS_VALID_UNTIL = '2028-01-15'

/**
 * Purchase tax on a price, marginal rate per bracket (each slice taxed at its own rate).
 * `singleApartment` false = a second/additional home, which pays 8% from the first shekel.
 */
export function purchaseTax(price: number, singleApartment: boolean): number {
  if (!(price > 0)) return 0
  const ladder = singleApartment ? SINGLE : ADDITIONAL
  let tax = 0
  let from = 0
  for (const [upTo, rate] of ladder) {
    if (price <= from) break
    const slice = Math.min(price, upTo) - from
    tax += slice * rate
    from = upTo
  }
  return Math.round(tax)
}

/** The bracket lines, for showing the user WHY the number is what it is. */
export function taxBreakdown(price: number, singleApartment: boolean): { label: string; amount: number }[] {
  const ladder = singleApartment ? SINGLE : ADDITIONAL
  const out: { label: string; amount: number }[] = []
  let from = 0
  for (const [upTo, rate] of ladder) {
    if (price <= from) break
    const slice = Math.min(price, upTo) - from
    const top = Math.min(price, upTo)
    out.push({
      label: `${(rate * 100).toFixed(rate * 100 % 1 ? 1 : 0)}% על ${from === 0 ? 'עד' : `${fmt(from)}–`}${fmt(top)}`,
      amount: Math.round(slice * rate),
    })
    from = upTo
  }
  return out
}

const fmt = (n: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(n)
