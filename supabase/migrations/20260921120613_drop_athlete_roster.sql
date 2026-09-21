-- The roster is gone, and so is the screen that read it.
--
-- `athlete_roster` and `athlete_email` existed for one screen: a signed-out
-- visitor had to see the athletes' names before picking one, and row level
-- security correctly shows a signed-out reader no rows at all. Both were
-- `security definer`, which means they answered without any policy applying —
-- the narrowest thing that could work, but still a hole cut in the wall.
--
-- There is no sign-in screen now. Nothing calls either function, and a
-- definer-rights function that reads names and addresses is not something to
-- leave lying around unused, so both go.

drop function if exists public.athlete_email(uuid);
drop function if exists public.athlete_roster();
