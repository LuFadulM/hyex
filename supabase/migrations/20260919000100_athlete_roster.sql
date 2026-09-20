-- Who can be picked on the way in, and how that pick becomes a session.
--
-- The way in used to be an email and a link. For a household of two people
-- that was all cost and no benefit: a link to find in an inbox, a provider
-- toggle to keep switched on, a mailer with a two-an-hour cap. The screen now
-- shows the athletes by name and asks for one shared code.
--
-- Nothing about the data model changes. Picking a name still ends in a real
-- Supabase session for that account, so `auth.uid()` is what it always was and
-- every row level security policy keeps working untouched. These two functions
-- exist only so the signed-out screen can render names and turn a pick into a
-- sign-in; neither can read a single row of anybody's training data.

-- The roster, for the signed-out screen. Display names only — no addresses, no
-- body data, no health answers.
--
-- Someone who has not finished the questionnaire still belongs here: without a
-- way in they could never reach onboarding to build a first plan. Signing in
-- sends them there, because the app's own gate reads `onboarded_at`, not this.
create or replace function public.athlete_roster()
returns table (user_id uuid, display_name text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.user_id, p.display_name
  from public.profiles p
  order by p.display_name;
$$;

-- The address behind a picked name, for the server action that signs in.
--
-- It returns only the address, never a credential: the code the athlete types
-- is checked by Supabase itself, against that account's own password hash. A
-- wrong code fails the sign-in exactly as a wrong password always did, with
-- the same rate limiting behind it.
create or replace function public.athlete_email(p_user_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where u.id = p_user_id;
$$;

revoke execute on function public.athlete_roster() from public;
revoke execute on function public.athlete_email(uuid) from public;
grant execute on function public.athlete_roster() to anon, authenticated;
grant execute on function public.athlete_email(uuid) to anon, authenticated;
