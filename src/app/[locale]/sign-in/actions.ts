'use server'

import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { defaultLocale, isLocale, type Locale } from '@/i18n/routing'
import { classifyPasswordFailure } from '@/lib/auth/errors'
import { safeRedirectPath } from '@/lib/auth/routes'
import { createClient } from '@/lib/supabase/server'

export interface SignInState {
  /** A message key, never prose — the form translates it (PLAN.md §4). */
  errorKey?: string
}

const enterSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(1).max(72),
  locale: z.string().refine(isLocale),
  next: z.string().optional(),
})

/**
 * The only way in: pick your name, type the shared code.
 *
 * What this replaced was four ways in — a magic link, a typed six-digit code,
 * an anonymous session and an email-and-password form — and between them they
 * managed to lock the household out for two days. The link needed an inbox and
 * a mailer capped at two messages an hour; the anonymous session needed a
 * project setting; the password form needed another. None of that is worth it
 * for two people who train together.
 *
 * Underneath, this is still a real sign-in. The code is that account's Supabase
 * password, checked by Supabase against its own hash with its own rate limiting
 * — nothing here compares secrets itself. So the session is a normal one,
 * `auth.uid()` is what it always was, and every row level security policy keeps
 * working with no change at all. What went away is the ceremony, not the lock.
 *
 * The session cookie is what "remembers this device": after the first time, the
 * middleware refreshes it and nobody types anything again.
 */
export async function enterAsAthlete(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = enterSchema.safeParse({
    userId: formData.get('userId'),
    code: formData.get('code'),
    locale: formData.get('locale'),
    next: formData.get('next') ?? undefined,
  })
  if (!parsed.success) return { errorKey: 'auth.errors.wrongCode' }

  const { userId, code, locale, next } = parsed.data
  const supabase = await createClient()

  // The picked name is a profile id; the address behind it never reaches the
  // browser, and the roster never carried it in the first place.
  const { data: email, error: lookupError } = await supabase.rpc('athlete_email', { p_user_id: userId })
  if (lookupError || !email) return { errorKey: 'auth.errors.wrongCode' }

  const { error } = await supabase.auth.signInWithPassword({ email, password: code })
  if (error) {
    const kind = classifyPasswordFailure(error)
    // "Those credentials do not match" means the code was wrong, and saying so
    // reveals nothing here: the name was already on the screen.
    return { errorKey: kind === 'invalidCredentials' ? 'auth.errors.wrongCode' : `auth.errors.${kind}` }
  }

  redirect(safeRedirectPath(next ?? null, locale) as Route)
}

export async function signOut(locale: string) {
  const target: Locale = isLocale(locale) ? locale : defaultLocale
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/${target}`)
}
