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

export type RouteDecision =
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string }

/**
 * Decides what to do with a request.
 *
 * Nobody should ever reach here signed out: the middleware signs every visitor
 * into the shared account before asking. If that failed — a deployment with no
 * database behind it — the landing page is the one thing that still renders,
 * in the visitor's own language, so they see the app rather than a stack
 * trace. There is no sign-in screen to send them to and nothing for them to
 * type, so nothing is carried along.
 */
export function routeDecision(pathname: string, isSignedIn: boolean): RouteDecision {
  const { locale } = parsePath(pathname)

  if (!isSignedIn && isProtectedPath(pathname)) {
    return { kind: 'redirect', to: `/${locale}/welcome` }
  }

  return { kind: 'allow' }
}

/**
 * Validates a `next` parameter before redirecting to it.
 *
 * Only same-origin, locale-relative paths are allowed: an open redirect here
 * would turn every link that carries one into a phishing vector.
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
