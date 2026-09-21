'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Locale } from '@/i18n/routing'
import type { Athlete } from '@/lib/data/roster'
import { enterAsAthlete, type SignInState } from './actions'

/**
 * Pick your name, type the shared code.
 *
 * Two people who train together do not need to tell an app who they are by
 * typing an address: the app already knows both of them. Tapping a name is the
 * whole identification step, and the code is what keeps the open internet out
 * of somebody's weight and health answers.
 *
 * Once in, the session cookie keeps this device signed in, so this screen is
 * something each phone sees once.
 */
export function SignInForm({
  locale,
  next,
  roster,
}: {
  locale: Locale
  next?: string
  roster: Athlete[]
}) {
  const t = useTranslations('auth')
  const [picked, setPicked] = useState<Athlete | null>(roster.length === 1 ? roster[0]! : null)
  const [state, formAction, pending] = useActionState<SignInState, FormData>(enterAsAthlete, {})

  if (roster.length === 0) {
    return <p className="text-sm text-(--color-ink-muted)">{t('noAthletes')}</p>
  }

  if (!picked) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">{t('whoIsTraining')}</p>
        {roster.map((athlete) => (
          <button
            key={athlete.userId}
            type="button"
            onClick={() => setPicked(athlete)}
            className="min-h-14 rounded-xl bg-(--color-plate-blue) px-4 font-display text-lg font-bold text-white"
          >
            {athlete.displayName}
          </button>
        ))}
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="userId" value={picked.userId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <p className="font-display text-lg font-bold">{t('hello', { name: picked.displayName })}</p>

      <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="code">
        {t('codeLabel')}
        <input
          id="code"
          name="code"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-describedby={state.errorKey ? 'sign-in-error' : 'code-hint'}
          aria-invalid={state.errorKey ? true : undefined}
          className="min-h-12 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base"
        />
      </label>

      <p id="code-hint" className="text-xs text-(--color-ink-muted)">{t('codeHint')}</p>

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
        {pending ? t('entering') : t('enter')}
      </button>

      {roster.length > 1 && (
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="min-h-11 text-sm text-(--color-ink-muted) underline-offset-2 hover:underline"
        >
          {t('notYou')}
        </button>
      )}
    </form>
  )
}
