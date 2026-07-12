// Shared admin-email gate for the feedback edge functions. The owner's real account is the
// admin on production; on staging the dedicated TEST account is ALSO an admin (it's the
// identity logged into the staging workspace, and it must be able to guide the bot + promote).
// Set FEEDBACK_ADMIN_EMAILS (comma-separated) to include the test account; FEEDBACK_ADMIN_EMAIL
// stays as the single-value fallback so nothing breaks if only it is set.

export function adminEmails(): Set<string> {
  const list = (Deno.env.get('FEEDBACK_ADMIN_EMAILS') ?? '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const single = (Deno.env.get('FEEDBACK_ADMIN_EMAIL') ?? 'itai.shubi@gmail.com').toLowerCase()
  return new Set<string>([single, ...list])
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().has(email.toLowerCase())
}
