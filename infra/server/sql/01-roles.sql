-- Run ONCE on the new server, BEFORE restoring the Supabase dump.
--   docker compose exec -T postgres psql -U postgres -d app \
--     -v authenticator_password="$AUTHENTICATOR_PASSWORD" < sql/01-roles.sql
--
-- Recreates the roles Supabase has, so supabase-js keys and the existing security rules work unchanged.

-- Roles that API keys switch into (chosen by the "role" inside the key).
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- The login PostgREST uses. It can only switch into the roles above.
create role authenticator login noinherit password :'authenticator_password';
grant anon, authenticated, service_role to authenticator;

-- Supabase installs extensions into a schema named "extensions".
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
alter database app set search_path = public, extensions;

-- Two accounting tables (entities, journal_entries) reference Supabase's auth.users.
-- This empty stand-in lets the restore succeed. The app has its own login and never fills it.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
