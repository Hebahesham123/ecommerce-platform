-- =============================================================================
-- Customers · a face to go with the name
-- =============================================================================
-- The account page drew two initials in a circle, which is what you show when
-- you have nothing — and there was no way to give it anything. A customer can
-- now set her own picture.
--
-- Only the URL is kept here. The image itself goes to the files bucket under a
-- random name, so the address of a customer's photo gives away nothing about
-- who she is — a path built from her phone number would have published it to
-- anyone the link reached.
-- =============================================================================

alter table public.store_customers
  add column if not exists avatar_url text;
