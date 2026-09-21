'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { changePassword } from '@/lib/actions/account'

const field =
  'min-h-11 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base font-normal'

/**
 * The account card: who you are here, and the code that gets you in.
 *
 * There is nothing to attach or upgrade any more. The address on the account
 * is only a label — the way in is a name and a shared code, and this is where
 * that code is changed.
 */
export function AccountCard({ email }: { email: string | null }) {
  const t = useTranslations('settings.account')
  const row = 'flex flex-col gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) p-4'

  return (
    <section className={row}>
      <h2 className="font-display text-lg font-bold">{t('title')}</h2>
      {email && <p className="text-sm text-(--color-ink-muted)">{t('signedInAs', { email })}</p>}
      <PasswordForm />
    </section>
  )
}

/**
 * Changing the code.
 *
 * It asks for the current one first. A session cookie is something a borrowed
 * or unlocked phone already has; the old code is something only the person who
 * uses this account knows. Without that check, a phone left on a bench is
 * enough to lock its owner out for good.
 */
function PasswordForm() {
  const t = useTranslations('settings.password')
  const tAuth = useTranslations('auth')
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ current: '', next: '' })

  const message = (key: string) =>
    key.startsWith('auth.') ? tAuth(key.replace('auth.', '')) : t(key.replace('settings.password.', ''))

  if (done) {
    return <p role="status" className="text-sm font-semibold text-(--color-plate-green)">{t('changed')}</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-left text-sm font-semibold text-(--color-plate-blue) underline-offset-2 hover:underline"
      >
        {t('change')}
      </button>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(ev) => {
        ev.preventDefault()
        setErrorKey(null)
        startTransition(async () => {
          const result = await changePassword(form)
          if (result.ok) setDone(true)
          else setErrorKey(result.errorKey)
        })
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('current')}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t('next')}
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
          className={field}
        />
      </label>

      <p className="text-xs text-(--color-ink-muted)">{t('hint')}</p>

      {errorKey && <p role="alert" className="text-sm text-(--color-plate-red)">{message(errorKey)}</p>}

      <button
        type="submit"
        disabled={pending || !form.current || form.next.length < 8}
        className="min-h-11 rounded-lg bg-(--color-plate-blue) font-semibold text-white disabled:opacity-60"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </form>
  )
}
