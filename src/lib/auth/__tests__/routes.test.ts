import { describe, expect, it } from 'vitest'
import {
  isProtectedPath,
  parsePath,
  routeDecision,
  safeRedirectPath,
} from '../routes'

describe('parsePath', () => {
  it('splits the locale from the rest of the path', () => {
    expect(parsePath('/es/today')).toEqual({ locale: 'es', rest: '/today', segment: 'today' })
    expect(parsePath('/en/plan/week/3')).toEqual({
      locale: 'en',
      rest: '/plan/week/3',
      segment: 'plan',
    })
  })

  it('falls back to the default locale (Spanish) when the prefix is missing', () => {
    expect(parsePath('/today').locale).toBe('es')
    expect(parsePath('/today').segment).toBe('today')
  })

  it('handles the locale root and the bare root', () => {
    expect(parsePath('/es')).toEqual({ locale: 'es', rest: '/', segment: '' })
    expect(parsePath('/')).toEqual({ locale: 'es', rest: '/', segment: '' })
  })

  it('does not mistake a path segment for a locale', () => {
    // 'english' starts with 'en' but is not a locale, so the default applies.
    expect(parsePath('/english/today').locale).toBe('es')
    expect(parsePath('/english/today').segment).toBe('english')
  })
})

describe('path classification', () => {
  it('recognises the routes that need a session', () => {
    for (const path of ['/en/today', '/es/plan', '/en/settings', '/es/onboarding']) {
      expect(isProtectedPath(path)).toBe(true)
    }
  })

  it('leaves public routes alone', () => {
    for (const path of ['/en', '/es', '/en/privacy', '/es/welcome']) {
      expect(isProtectedPath(path)).toBe(false)
    }
  })
})

describe('routeDecision', () => {
  // Nobody should ever be signed out: the middleware opens a session before
  // asking. This is the deployment-is-broken path, and all it must do is show
  // something in the right language rather than fail.
  it('falls back to the page that explains the app, in their own language', () => {
    expect(routeDecision('/es/today', false)).toEqual({ kind: 'redirect', to: '/es/welcome' })
    expect(routeDecision('/en/today', false)).toEqual({ kind: 'redirect', to: '/en/welcome' })
  })

  it('carries nothing along, because there is nothing to come back from', () => {
    const decision = routeDecision('/es/plan/week/3', false)

    expect(decision.kind).toBe('redirect')
    if (decision.kind !== 'redirect') return
    expect(decision.to).not.toContain('next=')
  })

  it('lets anyone see the public routes', () => {
    expect(routeDecision('/es', false)).toEqual({ kind: 'allow' })
    expect(routeDecision('/es/welcome', false)).toEqual({ kind: 'allow' })
  })

  it('lets a signed-in athlete through everywhere', () => {
    for (const path of ['/en/today', '/es/plan', '/en', '/es/library', '/es/welcome']) {
      expect(routeDecision(path, true)).toEqual({ kind: 'allow' })
    }
  })
})

describe('safeRedirectPath', () => {
  it('adds the locale prefix to a bare path', () => {
    expect(safeRedirectPath(encodeURIComponent('/plan'), 'es')).toBe('/es/plan')
  })

  it('leaves an already-localised path alone', () => {
    expect(safeRedirectPath(encodeURIComponent('/es/plan'), 'es')).toBe('/es/plan')
  })

  it('falls back when nothing was requested', () => {
    expect(safeRedirectPath(null, 'en')).toBe('/en/today')
    expect(safeRedirectPath('', 'es')).toBe('/es/today')
  })

  // An open redirect here would make every link that carries one a phishing
  // vector.
  it('refuses absolute URLs to other origins', () => {
    expect(safeRedirectPath(encodeURIComponent('https://evil.example/x'), 'en')).toBe('/en/today')
  })

  it('refuses protocol-relative URLs', () => {
    expect(safeRedirectPath(encodeURIComponent('//evil.example/x'), 'en')).toBe('/en/today')
  })

  it('refuses backslash and scheme tricks browsers may normalise', () => {
    expect(safeRedirectPath(encodeURIComponent('/\\evil.example'), 'en')).toBe('/en/today')
    expect(safeRedirectPath(encodeURIComponent('javascript:alert(1)'), 'en')).toBe('/en/today')
    expect(safeRedirectPath(encodeURIComponent('/x:y'), 'en')).toBe('/en/today')
  })

  it('refuses a malformed encoding rather than throwing', () => {
    expect(safeRedirectPath('%E0%A4%A', 'en')).toBe('/en/today')
  })
})
