import { describe, expect, it } from 'vitest'
import { classifyExchangeFailure } from '../errors'

describe('classifyExchangeFailure', () => {
  it('spots a link opened in a browser other than the one that asked for it', () => {
    expect(classifyExchangeFailure({ message: 'invalid request: both auth code and code verifier should be non-empty' })).toBe('other_device')
  })

  it('leaves a consumed or expired link as a plain exchange failure', () => {
    expect(classifyExchangeFailure({ message: 'invalid flow state, no valid flow state found' })).toBe('exchange_failed')
    expect(classifyExchangeFailure({})).toBe('exchange_failed')
  })
})
