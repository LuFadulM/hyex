import { expect, test } from '@playwright/test'
import { sharedAccount } from '../src/lib/supabase/shared-account'
import { admin, hasSupabase } from './helpers'

const account = sharedAccount()

/**
 * There is no way in, because there is no door.
 *
 * This is the whole promise of the app now: open it and you are training. No
 * name to pick, no code to type, no link to wait for. Every earlier way in
 * failed on something outside the app — an inbox, a mailer's hourly cap, a
 * project setting nobody could reach — and each failure locked the household
 * out of its own data. Nothing here can fail that way, and this test is what
 * keeps it that way: it drives a phone that has never seen the app before.
 */
test.describe('opening the app', () => {
  test.skip(!hasSupabase, 'needs a local Supabase')
  test.skip(!account, 'needs HYEX_ACCOUNT_CODE, the way a deployment has one')

  test.beforeAll(async () => {
    // The one account every visitor is signed into. Confirmed outright: no
    // message is ever sent to this address, and none is ever waited for.
    if (!account) return
    const { data } = await admin().auth.admin.listUsers()
    if (data?.users.some((u) => u.email === account.email)) return
    const { error } = await admin().auth.admin.createUser({
      email: account.email,
      password: account.code,
      email_confirm: true,
    })
    if (error) throw error
  })

  test('a phone that has never seen it lands inside, with nothing typed', async ({ page }) => {
    // A brand-new phone: no session, no cookies, nothing remembered.
    await page.context().clearCookies()

    await page.goto('/es')

    // Straight to the questionnaire or straight to today, depending only on
    // whether this athlete has a plan yet — never to a screen that asks.
    await page.waitForURL(/\/es\/(today|onboarding)/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Nothing on the way in asked for anything.
    await expect(page.locator('input[type=password]')).toHaveCount(0)
  })

  test('leaves no trace of the hop in the address bar', async ({ page }) => {
    // Signing someone in costs one redirect, because cookies only arrive on
    // the next request. The marker that makes it a single hop rather than a
    // loop must not survive into the URL the athlete sees.
    await page.context().clearCookies()

    await page.goto('/es')
    await page.waitForURL(/\/es\/(today|onboarding)/, { timeout: 30_000 })

    expect(page.url()).not.toContain('hx=')
  })
})
