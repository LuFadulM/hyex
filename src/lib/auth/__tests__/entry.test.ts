import { describe, expect, it } from 'vitest'
import { entryHop, type EntryState } from '../entry'

/** The middleware's own rule, as the app applies it request after request. */
function walk(
  start: { hasSession: boolean; keepsCookies: boolean },
  steps = 10,
): EntryHop[] {
  const trail: EntryHop[] = []
  let hasSession = start.hasSession
  let hopped = false

  for (let i = 0; i < steps; i++) {
    // A request with no session gets one; whether it survives to the next
    // request is up to the browser.
    const created = !hasSession
    const hop = entryHop({ hopped, created, alreadyRedirecting: false })
    trail.push(hop)
    if (hop === 'none') break

    hasSession = created ? start.keepsCookies : true
    hopped = hop === 'mark'
  }
  return trail
}

type EntryHop = ReturnType<typeof entryHop>

describe('entryHop', () => {
  it('bounces a brand-new visitor once, then cleans the URL, then settles', () => {
    expect(walk({ hasSession: true, keepsCookies: true })).toEqual(['none'])
    expect(walk({ hasSession: false, keepsCookies: true })).toEqual(['mark', 'unmark', 'none'])
  })

  it('gives up rather than looping when the browser keeps no cookies', () => {
    // The dangerous case: a session is created on every single request, so a
    // rule that only asked "is there a session?" would bounce forever.
    expect(walk({ hasSession: false, keepsCookies: false })).toEqual(['mark', 'none'])
  })

  it('never bounces while something else is already redirecting', () => {
    for (const hopped of [true, false]) {
      for (const created of [true, false]) {
        expect(entryHop({ hopped, created, alreadyRedirecting: true })).toBe('none')
      }
    }
  })

  it('leaves a settled visitor alone whichever way they arrive', () => {
    const settled: EntryState = { hopped: false, created: false, alreadyRedirecting: false }
    expect(entryHop(settled)).toBe('none')
    expect(entryHop({ ...settled, hopped: true, created: true })).toBe('none')
  })
})
