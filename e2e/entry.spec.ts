import { expect, test } from '@playwright/test'
import { admin, hasSupabase, unique } from './helpers'

/**
 * Creating an account and coming back to it, the way a person actually does.
 *
 * Every earlier way in depended on something outside the app — a message being
 * delivered, a provider being switched on, a row written into `auth.users` by
 * hand — and each one broke without saying so. This walks the whole thing
 * through the browser with nothing else involved: type an address and a
 * password, land in the questionnaire, come back on a clean phone, get in.
 *
 * If a message ever has to be opened for either half, this fails.
 */
test.describe('accounts', () => {
  test.skip(!hasSupabase, 'needs a local Supabase')

  const EMAIL = /^Email$/
  const PASSWORD = /^Password$/
  const CREATE = 'Create my account'
  const LOG_IN = 'Log in'
  const TO_CREATE = 'First time here? Create an account'

  /** Long enough to pass, and nothing like a real one. */
  const PASSPHRASE = 'three-word-passphrase'

  /**
   * Finds one account by address, across however many pages there are.
   *
   * `listUsers()` is paginated and answers with the first fifty by default, so
   * on a suite where every test makes an account, one page is not the whole
   * list. Asking for page one and reading a miss as "the account does not
   * exist" is how this test failed while the app was working perfectly — the
   * same run proved the account was really there, by refusing to create a
   * second one on that address.
   *
   * The error is raised rather than swallowed for the same reason: the first
   * version destructured `data` alone, so a failed call and an empty page were
   * indistinguishable, and the message said neither.
   */
  async function findAccount(email: string) {
    const perPage = 200
    for (let page = 1; page <= 25; page++) {
      const { data, error } = await admin().auth.admin.listUsers({ page, perPage })
      if (error) throw error
      const hit = data.users.find((u) => u.email === email)
      if (hit) return hit
      if (data.users.length < perPage) return undefined
    }
    return undefined
  }

  async function createAccountWith(page: import('@playwright/test').Page, email: string) {
    await page.goto('/en/sign-in')
    await page.getByRole('button', { name: TO_CREATE }).click()
    await page.getByLabel(EMAIL).fill(email)
    await page.getByLabel(PASSWORD).fill(PASSPHRASE)
    await page.getByRole('button', { name: CREATE }).click()
  }

  test('creates an account, then lets it back in', async ({ page }) => {
    const email = unique('entry')

    await createAccountWith(page, email)

    // A new account has no plan, so the questionnaire is where it belongs.
    await page.waitForURL(/\/en\/onboarding/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Signing up has to leave a usable session behind, not an account waiting
    // on a link: it exists *and* it is confirmed.
    const created = await findAccount(email)
    expect(created, 'the account exists').toBeTruthy()
    expect(created?.email_confirmed_at, 'and needs no message to be opened').toBeTruthy()

    // Back as a phone that has never seen this account.
    await page.context().clearCookies()
    await page.goto('/en/sign-in')
    await page.getByLabel(EMAIL).fill(email)
    await page.getByLabel(PASSWORD).fill(PASSPHRASE)
    await page.getByRole('button', { name: LOG_IN }).click()

    await page.waitForURL(/\/en\/(today|onboarding)/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('refuses a wrong password without leaking who has an account', async ({ page }) => {
    const email = unique('entry-wrong')

    await createAccountWith(page, email)
    await page.waitForURL(/\/en\/onboarding/, { timeout: 30_000 })

    await page.context().clearCookies()
    await page.goto('/en/sign-in')
    await page.getByLabel(EMAIL).fill(email)
    await page.getByLabel(PASSWORD).fill('not-the-passphrase')
    await page.getByRole('button', { name: LOG_IN }).click()

    const error = page.locator('#sign-in-error')
    await expect(error).toBeVisible()
    // Worded the same as an address with no account behind it, so the form
    // cannot be used to ask "does this person use Hyex?".
    await expect(error).toContainText('do not match an account')
    await expect(page).toHaveURL(/\/en\/sign-in/)
  })

  test('will not make a second account on one address', async ({ page }) => {
    const email = unique('entry-dup')

    await createAccountWith(page, email)
    await page.waitForURL(/\/en\/onboarding/, { timeout: 30_000 })

    await page.context().clearCookies()
    await createAccountWith(page, email)

    await expect(page.locator('#sign-in-error')).toContainText('already an account')
    await expect(page).toHaveURL(/\/en\/sign-in/)
  })
})
