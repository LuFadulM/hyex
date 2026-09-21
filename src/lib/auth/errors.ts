/**
 * Turns Supabase Auth failures into something the callback can act on.
 *
 * Pure so it can be unit tested without a Supabase client: the caller passes
 * the status and message it got back.
 *
 * Only one classifier is left. The rest sorted out failures on screens that no
 * longer exist — a link that could not be sent, a typed code that was wrong or
 * spent, a code the athlete was changing — and the app now has no screen that
 * asks for any of it.
 */
export interface AuthFailure {
  status?: number
  code?: string
  message?: string
}

export type ExchangeFailure = 'other_device' | 'exchange_failed'

/**
 * A PKCE exchange needs the code verifier cookie set by the browser that asked
 * for the link. When the link is opened somewhere else — a mail app's built-in
 * browser is the usual case — Supabase answers that the verifier is missing.
 * That is not an expired link, and the two are worth telling apart in a log.
 */
export function classifyExchangeFailure(error: AuthFailure): ExchangeFailure {
  if (/code verifier/i.test(error.message ?? '')) return 'other_device'
  return 'exchange_failed'
}
