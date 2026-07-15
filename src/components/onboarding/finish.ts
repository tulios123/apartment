// Pure decision logic for the onboarding finish, split out so it can be unit-tested
// without rendering the whole wizard hook (the test env is node/pure — no jsdom).

// Which write sections have already landed in a previous finish attempt, so a retry
// (after a partial failure that kept the user on the step) doesn't duplicate them.
// The contract is stashed as the created row, not a boolean, so the dependent rent
// reminder can reuse it on retry instead of creating a second contract.
export type SavedSections<Contract> = {
  tracks: boolean
  loans: boolean
  costs: boolean
  policies: boolean
  reminder: boolean
  contract: Contract | null
}

export function emptySavedSections<Contract>(): SavedSections<Contract> {
  return { tracks: false, loans: false, costs: false, policies: false, reminder: false, contract: null }
}

// After all writes are attempted, decide what finish should do. The whole point of
// the fix: only finalize (clear the local draft + advance to the celebratory "done"
// screen) when EVERYTHING saved. On a partial failure we keep the draft and stay on
// the step with a clear, retryable message — never claim "הכול מוכן!" over lost data.
export function finishOutcome(failures: string[]): { finalize: boolean; errorMessage: string | null } {
  if (failures.length === 0) return { finalize: true, errorMessage: null }
  return {
    finalize: false,
    errorMessage: `חלק מהפרטים לא נשמרו: ${failures.join(', ')}. הנתונים נשמרו במכשיר — תקנו ונסו שוב.`,
  }
}
