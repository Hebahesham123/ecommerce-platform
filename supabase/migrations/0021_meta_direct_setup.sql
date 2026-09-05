-- =============================================================================
-- Connecting Meta without the OAuth dance.
--
-- 0004 modelled the integration around Facebook Login: a developer app, an
-- app secret, business_management scopes, and a token fetched through a
-- redirect. That is the right shape for an app serving many merchants, and
-- pure overhead for a store connecting its own pixel — the merchant already
-- has both values in Events Manager and only needs somewhere to paste them.
--
-- `access_token` stays what OAuth produced (a user token, used for catalog
-- sync). A Conversions API token is a different credential with a different
-- lifetime, so it gets its own column rather than fighting over that one.
-- =============================================================================

alter table public.meta_connection
  add column if not exists capi_token text;

comment on column public.meta_connection.capi_token is
  'Conversions API access token, pasted from Events Manager. Server-only; never sent to the browser.';
comment on column public.meta_connection.access_token is
  'OAuth user token from Facebook Login. Only needed for catalog sync; the pixel and CAPI do not require it.';
