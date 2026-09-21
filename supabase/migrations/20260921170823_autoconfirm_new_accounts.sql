-- Accounts that work the moment they are made.
--
-- Two faults, one trigger, because both happen at exactly the same instant: a
-- row arriving in auth.users.
--
-- **Confirmed on arrival.** This project has "Confirm email" switched on, and
-- that setting cannot be reached from here — the management API is blocked and
-- no tool exposes it. With it on, `signUp` returns no session and the account
-- waits on a link from a mailer capped at two messages an hour. A real sign-up
-- at 16:59 on 2026-09-21 did exactly that: `POST /signup` 200, `mail.send`,
-- and an account nobody could use. Nothing in this app reads the address for
-- anything else, so the verification step buys nothing here and costs
-- everything. The trade is deliberate and worth saying out loud: an address is
-- never proved to belong to whoever typed it.
--
-- **Never NULL again.** The auth service scans `confirmation_token`,
-- `recovery_token`, `email_change_token_new` and `email_change` into
-- non-nullable Go strings, and unlike their siblings these four carry no
-- default. A row written by hand leaves them NULL, and then every password
-- sign-in for that account answers 500 with `converting NULL to string is
-- unsupported`, while one such row anywhere breaks the admin list endpoint for
-- the whole project. That cost days, twice — once in production and once in
-- `supabase/seed.sql` — and neither time did anything name the cause. Repairing
-- them here makes the mistake unrepeatable rather than merely documented.
--
-- The function lives in `public` because `auth` is not ours to write into.

create or replace function public.hyex_prepare_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;

  new.confirmation_token := coalesce(new.confirmation_token, '');
  new.recovery_token := coalesce(new.recovery_token, '');
  new.email_change_token_new := coalesce(new.email_change_token_new, '');
  new.email_change := coalesce(new.email_change, '');

  return new;
end;
$$;

drop trigger if exists hyex_prepare_new_user on auth.users;

create trigger hyex_prepare_new_user
before insert on auth.users
for each row execute function public.hyex_prepare_new_user();
