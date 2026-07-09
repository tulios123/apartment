// Pure feedback-pipeline status logic — kept dependency-free (no supabase import) so it's
// unit-testable without a live env. Split out of feedbackMessages.ts, which pulls in the
// supabase client and therefore can't be imported from a test.

// Statuses the admin may (re)send to the bot from: a fresh report, an inconclusive/failed
// run, or a fix that's up for review but turned out NOT to actually solve it once the
// owner checked — resending from 'awaiting_review' is how they say "didn't work, try
// again" and keep the ping-pong going instead of being stuck until it's merged or dropped.
// Mirrored (manually — different runtimes, no shared import) in
// supabase/functions/send-feedback-to-claude/index.ts.
const RESENDABLE_STATUSES = new Set(['new', 'failed', 'awaiting_review'])
export function canResendToBot(status: string): boolean {
  return RESENDABLE_STATUSES.has(status)
}
