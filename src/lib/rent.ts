/**
 * The day of the month rent is payable — the day the monthly reminder starts from.
 *
 * For rent paid by post-dated cheque this is the date WRITTEN ON THE CHEQUE: before it
 * the cheque cannot be deposited, so "deposit the cheque" must not be nagged earlier.
 * It lives on the rent recurring item (`day_of_month`), which is the row the reminder
 * actually reads.
 *
 * Resolution order — deliberately never moving a reminder EARLIER than it fires today:
 *  1. the day stored on the rent item, when it isn't the untouched default of 1,
 *  2. the lease's start day — a lease starting on the 15th is paid on the 15th.
 * Every rent item created before 06.09 sits on that default of 1, which is exactly why
 * the reminder used to start on the 1st of the month for everyone.
 *
 * Clamped to 1–28, the range `recurring_items.day_of_month` allows, so the day exists
 * in every month (February included).
 */
export function rentPaymentDay(input: {
  dayOfMonth?: number | null
  startDate?: string | null
}): number {
  const day = input.dayOfMonth
  if (day != null && day > 1) return Math.min(28, day)
  const startDay = Number(input.startDate?.slice(8, 10))
  if (Number.isFinite(startDay) && startDay >= 1) return Math.min(28, startDay)
  return 1
}

/**
 * Has this month's rent become payable yet? Gates the home screen's "was the cheque
 * deposited?" card so it doesn't greet the owner from the 1st of the month for a
 * cheque dated the 10th — the same day rule the daily push uses.
 */
export function isRentPayable(todayISO: string, day: number): boolean {
  return Number(todayISO.slice(8, 10)) >= day
}
