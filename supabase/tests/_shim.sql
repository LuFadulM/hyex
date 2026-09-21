-- Minimal stand-in for the parts of Supabase the migrations depend on, so the
-- schema can be applied and its policies exercised against plain Postgres.
-- Mirrors the grants a real Supabase project ships with.
create extension if not exists "pgcrypto";
create schema if not exists auth;

-- The token columns are here because a migration now writes to them: the
-- trigger that confirms new accounts also repairs these four, which the auth
-- service scans into non-nullable strings. Without them the trigger would
-- fail the moment this suite inserts a user, which is the point — the shim
-- has to carry every column the migrations touch, not only the ones the
-- policies read.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text
);

-- Mirrors Supabase's auth.uid(): reads the subject from a request-scoped GUC.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
