import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { AppNav } from '@/components/app-nav'
import { isLocale } from '@/i18n/routing'
import { redirect } from '@/i18n/navigation'
import { getProfile } from '@/lib/data/profile'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getCurrentUser } from '@/lib/supabase/server'

// Auth-gated: rendered per request, never prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * Everything behind the questionnaire. The middleware has already put a
 * session on the request, so the only gate left here is the questionnaire
 * itself: no profile yet means it has not been completed.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)

  // With no database behind the deployment there is no session to be had,
  // and nowhere to send anyone but the landing page.
  if (!isSupabaseConfigured()) redirect({ href: '/welcome', locale })

  const user = await getCurrentUser()
  if (!user) redirect({ href: '/welcome', locale })

  const profile = await getProfile()
  if (!profile?.onboarded_at) redirect({ href: '/onboarding', locale })

  return (
    <div className="mx-auto min-h-screen max-w-md pb-20">
      {children}
      <AppNav />
    </div>
  )
}
