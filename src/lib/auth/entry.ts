/**
 * The one redirect it takes to open a session, and why it cannot loop.
 *
 * Opening the app signs the visitor in, and a session exists as cookies on the
 * way out — so the request that created it would still render signed out. The
 * fix is to bounce that first request back to the same URL, where the cookies
 * have arrived. The risk is doing it forever.
 *
 * Kept here, pure, because the middleware around it needs a request, a cookie
 * jar and a running Supabase to exercise at all, and this is the part that has
 * to be right.
 */
export interface EntryState {
  /** This request already came back from a hop. */
  hopped: boolean
  /** A session was opened during this request, so only cookies carry it. */
  created: boolean
  /** Something else is already redirecting; cookies ride along on that. */
  alreadyRedirecting: boolean
}

export type EntryHop =
  /** Bounce to the same URL, marked, to deliver the session. */
  | 'mark'
  /** Bounce to the same URL, unmarked, now that it has arrived. */
  | 'unmark'
  /** Carry on and render. */
  | 'none'

/**
 * Every path through this reaches `'none'`, which is what stops it looping.
 *
 *   - A browser that keeps cookies: `mark` → `unmark` → `none`. Three requests
 *     the first time a phone ever opens the app, one request forever after,
 *     because the session is only *created* once.
 *   - A browser that throws them away: `mark` → (marked, and created all over
 *     again) → `none`. It renders signed out rather than bouncing forever; a
 *     visitor who refuses cookies cannot be given a session by trying harder.
 *   - A visitor who already has one: `none` immediately.
 */
export function entryHop({ hopped, created, alreadyRedirecting }: EntryState): EntryHop {
  if (alreadyRedirecting) return 'none'
  if (created && !hopped) return 'mark'
  if (hopped && !created) return 'unmark'
  return 'none'
}
