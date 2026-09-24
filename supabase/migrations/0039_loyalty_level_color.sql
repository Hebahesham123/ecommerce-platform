-- =============================================================================
-- Loyalty · a colour for each level
-- =============================================================================
-- The levels were told apart only by their names, so the storefront had to
-- invent colours for them in code — which meant the one place the programme is
-- actually configured had no say over how it looked.
--
-- The colour belongs with the threshold and the name: it is part of what a
-- level is. Stored as a single hex value; everything a screen needs — the
-- panel tint, its border, the accent — is mixed from it, so there is one thing
-- to set and no palette to keep consistent by hand.
-- =============================================================================

alter table public.loyalty_levels
  add column if not exists color text;

-- What the storefront was already drawing, so nothing changes appearance on
-- the day this runs. Only levels that have not been given a colour.
update public.loyalty_levels set color = '#7E7364' where key = 'discovery' and color is null;
update public.loyalty_levels set color = '#A46C3C' where key = 'curated'   and color is null;
update public.loyalty_levels set color = '#8F7226' where key = 'insider'   and color is null;
update public.loyalty_levels set color = '#9B4B41' where key = 'icon'      and color is null;
update public.loyalty_levels set color = '#6C5375' where key = 'muse'      and color is null;
