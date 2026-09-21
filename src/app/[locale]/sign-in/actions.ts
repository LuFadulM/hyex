'use server'

import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { defaultLocale, isLocale, type Locale } from '@/i18n/routing'
import { classifyPasswordFailure } from '@/lib/auth/errors'
import { landingAfterSignIn, safeRedirectPath } from '@/lib/auth/routes'
import { createClient } from '@/lib/supabase/server'

export interface SignInState {
  /** A message key, never prose — the form translates it. */
  errorKey?: string
}

/**
 * Eight characters, and no other rule.
 *
 * Supabase's own floor is six. Length is the part that actually matters, and
 * demanding a symbol and a digit mostly produces `Password1!` written on a
 * sticky note, so this asks for length and stops there. The cap is Supabase's:
 * bcrypt ignores anything past 72 bytes.
 */
const credentials = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  locale: z.string().refine(isLocale),
  next: z.string().optional(),
})

function parse(formData: FormData) {
  return credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    locale: formData.get('locale'),
    next: formData.get('next') ?? undefined,
  })
}

/**
 * Signing in with an address and a password.
 *
 * Nothing is sent anywhere and nothing has to arrive: the password is checked
 * by Supabase against its own hash, with its own rate limiting, and this app
 * never compares a secret itself. Every earlier way in depended on a message
 * being delivered or a provider being switched on, and every one of them broke.
 */
export async function logIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = parse(formData)
  if (!parsed.success) return { errorKey: 'auth.errors.invalidCredentials' }

  const { email, password, locale, next } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { errorKey: `auth.errors.${classifyPasswordFailure(error)}` }

  // Asked through the client that just signed in, rather than a fresh one:
  // the session exists in this request's memory but its cookies have not been
  // read back yet, so a new client would look signed out.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('user_id', data.user.id)
    .maybeSingle()

  const target = landingAfterSignIn({ onboarded: Boolean(profile?.onboarded_at), next })
  redirect(safeRedirectPath(target, locale) as Route)
}

/**
 * Creating an account.
 *
 * `signUp` hands back a session directly when the project does not require
 * email confirmation. When it does, the session comes back null — and this
 * project requires it, with the setting out of reach. So rather than stopping
 * there and telling someone to go and find a message, this signs them in with
 * the credentials they just chose.
 *
 * That works because a database trigger confirms every account as the row is
 * written (`20260921170823_autoconfirm_new_accounts`). The account is usable
 * the instant it exists, so the sign-in that follows succeeds and the person
 * lands in the questionnaire having typed an address and a password, once.
 *
 * The fallback still says something true if that ever stops holding: a session
 * that cannot be got at all means the account really is waiting on a link.
 *
 * Accounts are created through this, never by hand in SQL. A row written into
 * `auth.users` directly leaves `confirmation_token` and its siblings NULL,
 * where the auth service scans them into non-nullable strings, and every
 * password sign-in for that account then fails with a 500 that names nothing.
 * That is not hypothetical: it silently broke every account this project had,
 * and the same trigger now repairs it.
 */
export async function createAccount(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = parse(formData)
  if (!parsed.success) {
    const email = String(formData.get('email') ?? '')
    return { errorKey: email.includes('@') ? 'auth.errors.weakPassword' : 'auth.errors.badEmail' }
  }

  const { email, password, locale, next } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { errorKey: `auth.errors.${classifyPasswordFailure(error)}` }

  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) return { errorKey: 'auth.errors.confirmationRequired' }
  }

  // Straight to the questionnaire: a new account has no plan, and the app
  // would send them there from anywhere else anyway.
  redirect(safeRedirectPath(next ?? '/onboarding', locale) as Route)
}

export async function signOut(locale: string) {
  const target: Locale = isLocale(locale) ? locale : defaultLocale
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${target}`)
}
