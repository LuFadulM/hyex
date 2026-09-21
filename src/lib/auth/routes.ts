import { defaultLocale, isLocale, locales, type Locale } from '@/i18n/routing'

/**
 * Which routes need a session, and where to send someone who is in the wrong
 * place. Pure so it can be unit tested without a request, a cookie jar or a
 * running Supabase — the middleware only supplies the pathname and a boolean.
 */

/** Everything behind the questionnaire. */
export const PROTECTED_SEGMENTS = [
  'onboarding',
  'today',
  'plan',
  'run',
  'progress',
  'library',
  'group',
  'settings',
] as const

/** The way in: pointless once you already have a session. */
export const AUTH_SEGMENTS = ['sign-in'] as const

export interface ParsedPath {
  locale: Locale
  /** Path with the locale prefix removed, always starting with a slash. */
  rest: string
  /** First segment after the locale, or '' at the locale root. */
  segment: string
}

export function parsePath(pathname: string): ParsedPath {
  const parts = pathname.split('/').filter(Boolean)
  const maybeLocale = parts[0]
  const hasLocale = maybeLocale !== undefined && isLocale(maybeLocale)

  const locale: Locale = hasLocale ? maybeLocale : defaultLocale
  const remainder = hasLocale ? parts.slice(1) : parts

  return {
    locale,
    rest: `/${remainder.join('/')}`.replace(/\/$/, '') || '/',
    segment: remainder[0] ?? '',
  }
}

export function isProtectedPath(pathname: string): boolean {
  const { segment } = parsePath(pathname)
  return (PROTECTED_SEGMENTS as readonly string[]).includes(segment)
}

export function isAuthPath(pathname: string): boolean {
  const { segment } = parsePath(pathname)
  return (AUTH_SEGMENTS as readonly string[]).includes(segment)
}

export type RouteDecision =
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string }

/**
 * Decides what to do with a request.
 *
 * A signed-out visitor to a protected route is sent to sign-in **in their own
 * locale**, carrying where they were headed so they land there afterwards
 * rather than on a generic home screen.
 */
export function routeDecision(pathname: string, isSignedIn: boolean): RouteDecision {
  const { locale, rest } = parsePath(pathname)

  if (!isSignedIn && isProtectedPath(pathname)) {
    const next = encodeURIComponent(rest)
    return { kind: 'redirect', to: `/${locale}/sign-in?next=${next}` }
  }

  if (isSignedIn && isAuthPath(pathname)) {
    return { kind: 'redirect', to: `/${locale}/today` }
  }

  return { kind: 'allow' }
}

/**
 * Where a successful sign-in lands.
 *
 * The athlete's own data decides this, never which button they tapped to get
 * here. The landing page used to carry `next=/onboarding` on its "Get started"
 * button, so someone who already had a plan and happened to tap that one was
 * walked back through the whole questionnaire — and saving it wrote a second
 * set of answers and a second plan over the first. That is exactly what
 * happened on a second device at 17:29 on 2026-09-21.
 *
 * So: no plan yet means the questionnaire, whatever was asked for. With a plan,
 * a requested destination is honoured unless it is the questionnaire itself,
 * which nobody arriving at a sign-in screen meant to ask for. Reaching it
 * deliberately, from Settings, still works — that path carries no `next`.
 */
export function landingAfterSignIn(
  { onboarded, next }: { onboarded: boolean; next?: string | null },
): string {
  if (!onboarded) return '/onboarding'

  const wanted = decodeNext(next)
  if (!wanted || parsePath(wanted).segment === 'onboarding') return '/today'
  return wanted
}

/** Decodes a `next` far enough to read its first segment; never throws. */
function decodeNext(next?: string | null): string | null {
  if (!next) return null
  try {
    return decodeURIComponent(next)
  } catch {
    return null
  }
}

/**
 * Validates a `next` parameter before redirecting to it.
 *
 * Only same-origin, locale-relative paths are allowed: an open redirect here
 * would turn every sign-in link into a phishing vector.
 */
export function safeRedirectPath(next: string | null, locale: Locale): string {
  const fallback = `/${locale}/today`
  if (!next) return fallback

  let decoded: string
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return fallback
  }

  // Must be a rooted path, and must not be protocol-relative ("//evil.com")
  // or carry a scheme or backslash that a browser may normalise to one.
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback
  if (decoded.includes('\\') || decoded.includes(':')) return fallback

  const alreadyLocalised = locales.some(
    (l) => decoded === `/${l}` || decoded.startsWith(`/${l}/`),
  )
  return alreadyLocalised ? decoded : `/${locale}${decoded}`
}
