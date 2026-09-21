/**
 * The single account this app signs every visitor into.
 *
 * Hyex has no sign-in screen. Opening it puts you straight into the plan,
 * which means there is exactly one athlete: whoever opens the app is that
 * athlete, on any phone, with no name to pick and nothing to type.
 *
 * The account exists because Supabase wants a session behind every request.
 * With one, `auth.uid()` is a real user id and every row level security policy
 * keeps working exactly as written, unchanged from when there was a lock on
 * the door. Without one, every table would have to be opened to `anon`.
 *
 * The address is a mailbox that does not exist. Nothing is ever sent to it —
 * the account was confirmed directly in the database — and it is deliberately
 * not anybody's personal address, so this file names no real person.
 *
 * **The code is not in this file, and must never be.** This repository is
 * public. A password committed to it is published to everyone, permanently,
 * and harvested by the bots that scan GitHub for exactly that — which would
 * hand them the database's REST API directly, around the app, for every table
 * this account can reach today and every table it can reach later. That it
 * guards a door already standing open is not a reason to publish it; it is a
 * reason to keep the open door as the only way in. So it comes from the
 * environment, and when it is missing the app does not guess: it serves the
 * public pages and nothing else.
 */
export interface SharedAccount {
  email: string
  code: string
}

/** Not a secret: an address nobody reads, at a domain this app owns. */
const DEFAULT_EMAIL = 'athlete@hyex.app'

/** Null when no code is configured, which is a deployment that cannot open. */
export function sharedAccount(): SharedAccount | null {
  const code = process.env.HYEX_ACCOUNT_CODE
  if (!code) return null

  return { email: process.env.HYEX_ACCOUNT_EMAIL || DEFAULT_EMAIL, code }
}
