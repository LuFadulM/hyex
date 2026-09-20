import { createClient } from '@/lib/supabase/server'

export interface Athlete {
  userId: string
  displayName: string
}

/**
 * The athletes this copy of Hyex is for, by name.
 *
 * Read before anyone is signed in, so it cannot come from `profiles` directly —
 * row level security correctly returns nothing to a signed-out reader. It comes
 * from an RPC that returns display names and nothing else: no address, no body
 * data, no health answers, and no way to ask for them.
 *
 * Someone who has not built a plan yet is still on it. Leaving them off would
 * mean no way to reach onboarding, and the app already sends anyone without a
 * finished questionnaire straight there.
 */
export async function getRoster(): Promise<Athlete[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('athlete_roster')
  if (error || !data) return []
  return data.map((row) => ({ userId: row.user_id, displayName: row.display_name }))
}
