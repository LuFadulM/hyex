'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import { createAccount, logIn, type SignInState } from './actions'

type Mode = 'logIn' | 'createAccount'

/**
 * One address, one password, two buttons' worth of intent.
 *
 * The same two fields serve both jobs, so the form does not move around under
 * anyone's thumbs when they switch; only the button and the link below it
 * change. Keeping the typed values across the switch matters more than it
 * looks: the usual reason to switch is having guessed wrong about whether you
 * already have an account, and re-typing an address on a phone to correct that
 * guess is exactly the friction this app keeps failing on.
 */
export function SignInForm({ locale, next }: { locale: Locale; next?: string }) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<Mode>('logIn')
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    mode === 'logIn' ? logIn : createAccount,
    {},
  )

  const other: Mode = mode === 'logIn' ? 'createAccount' : 'logIn'

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="email">
        {t('emailLabel')}
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby={state.errorKey ? 'sign-in-error' : undefined}
          aria-invalid={state.errorKey ? true : undefined}
          className="min-h-12 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="password">
        {t('passwordLabel')}
        <input
          id="password"
          name="password"
          type="password"
          // Telling the browser which job this is lets it offer the saved
          // password when logging in, and offer to save a new one when not.
          autoComplete={mode === 'logIn' ? 'current-password' : 'new-password'}
          required
          minLength={8}
          aria-describedby={state.errorKey ? 'sign-in-error' : 'password-hint'}
          aria-invalid={state.errorKey ? true : undefined}
          className="min-h-12 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base"
        />
      </label>

      <p id="password-hint" className="text-xs text-(--color-ink-muted)">
        {t('passwordHint')}
      </p>

      {state.errorKey ? (
        <p id="sign-in-error" role="alert" className="text-sm text-(--color-plate-red)">
          {t(state.errorKey.replace('auth.', ''))}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white disabled:opacity-60"
      >
        {pending ? t('working') : t(mode)}
      </button>

      <button
        type="button"
        onClick={() => setMode(other)}
        className="min-h-11 text-sm text-(--color-ink-muted) underline-offset-2 hover:underline"
      >
        {t(other === 'createAccount' ? 'switchToCreate' : 'switchToLogIn')}
      </button>
    </form>
  )
}
