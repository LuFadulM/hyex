import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { redirect } from '@/i18n/navigation'
import { getProfile } from '@/lib/data/profile'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getCurrentUser } from '@/lib/supabase/server'

// Decided per request from the athlete's own state; never prerendered.
export const dynamic = 'force-dynamic'

/**
 * The front door, which opens straight onto the training.
 *
 * Hyex is a two-person app on a phone's home screen, not a shop window: the
 * person opening it wants today's session, not a page about the app. So there
 * is nothing to read and nothing to tap — the middleware has already put a
 * session on the request, and this decides which screen that session is owed.
 *
 * `/welcome` still holds the page that explains the app, for a link shared
 * with someone who has never seen it, and is where anyone lands if there is
 * no database behind the deployment to have a session with.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  if (!isSupabaseConfigured()) redirect({ href: '/welcome', locale })

  const user = await getCurrentUser()
  if (!user) redirect({ href: '/welcome', locale })

  const profile = await getProfile()
  redirect({ href: profile?.onboarded_at ? '/today' : '/onboarding', locale })
}
