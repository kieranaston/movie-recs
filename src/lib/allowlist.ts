/**
 * Who may sign in: the comma-separated, case-insensitive email list in ALLOWED_EMAILS.
 * An empty or missing list admits nobody (fail closed).
 */
export function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAllowedEmail(email: string | null | undefined, raw = process.env.ALLOWED_EMAILS): boolean {
  if (!email) return false;
  return parseAllowlist(raw).has(email.trim().toLowerCase());
}
