// A month is a *forecast* once it's past the current one: its rent/mortgage/loan
// figures come from the projection engine, not from booked transactions. The
// finances screen uses this to badge "מאזן החודש" with "צפי" so a future month
// doesn't read like a settled fact (owner feedback #56).
export function isForecastMonth(year: number, month: number, today: Date): boolean {
  const cy = today.getFullYear()
  const cm = today.getMonth() + 1
  return year > cy || (year === cy && month > cm)
}
