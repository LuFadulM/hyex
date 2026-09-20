import { expect, test } from '@playwright/test'
import { BASE_URL, completeOnboarding, createUser, hasSupabase, signIn, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase')

/**
 * The only way in: tap a name, type the shared code.
 *
 * Nothing is emailed and nothing is clicked in an inbox, which is the whole
 * point — the household was locked out for two days by a flow that needed one.
 * If this ever starts requiring a message, it fails here.
 */
test('an athlete picks their name, enters the code and lands on today', async ({ page }) => {
  const email = unique('entry')
  const code = 'hyex-shared-code'
  const name = `Ruta${Date.now().toString().slice(-6)}`

  await createUser(email, code)
  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name })

  // A fresh device: no session, so the way in has to carry the whole job.
  await page.context().clearCookies()
  await page.goto(`${BASE_URL}/en/sign-in`)

  await page.getByRole('button', { name, exact: true }).click()
  await page.getByLabel('Code').fill(code)
  await page.getByRole('button', { name: 'Go', exact: true }).click()

  await page.waitForURL(/\/en\/(today|onboarding)/, { timeout: 30_000 })
})

test('a wrong code says so and does not let anyone in', async ({ page }) => {
  const email = unique('entry-bad')
  const name = `Cerro${Date.now().toString().slice(-6)}`

  await createUser(email, 'hyex-shared-code')
  await signIn(page, email, 'en')
  await completeOnboarding(page, 'en', { name })

  await page.context().clearCookies()
  await page.goto(`${BASE_URL}/en/sign-in`)

  await page.getByRole('button', { name, exact: true }).click()
  await page.getByLabel('Code').fill('not-the-shared-code')
  await page.getByRole('button', { name: 'Go', exact: true }).click()

  await expect(page.locator('#sign-in-error')).toContainText('not right')
  await expect(page).toHaveURL(/\/en\/sign-in/)
})
