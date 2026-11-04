-- Rewrites saved file links from Supabase Storage to our own server, in every text/json column of
-- every table in "public".
--   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
--   → https://srv2120209.hstgr.cloud/media/<bucket>/<path>
--
-- Count only (changes nothing):
--   psql -v old="https://jvjnpfaoqfeodzujsngf.supabase.co/storage/v1/object/public/" \
--        -v new="https://srv2120209.hstgr.cloud/media/" -v apply=0 < 03-rewrite-storage-urls.sql
-- Apply: same with -v apply=1 (runs in one transaction).

select set_config('rewrite.old', :'old', false), set_config('rewrite.new', :'new', false),
       set_config('rewrite.apply', :'apply', false);

begin;
do $$
declare
  c record;
  n bigint;
  total bigint := 0;
  old_prefix text := current_setting('rewrite.old');
  new_prefix text := current_setting('rewrite.new');
  do_apply boolean := current_setting('rewrite.apply') = '1';
begin
  for c in
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying', 'jsonb', 'json')
      and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
    order by table_name, column_name
  loop
    execute format('select count(*) from public.%I where %I::text like %L', c.table_name, c.column_name, '%' || old_prefix || '%') into n;
    if n > 0 then
      raise notice '%.%: % rows', c.table_name, c.column_name, n;
      total := total + n;
      if do_apply then
        execute format(
          'update public.%I set %I = replace(%I::text, %L, %L)::%s where %I::text like %L',
          c.table_name, c.column_name, c.column_name, old_prefix, new_prefix,
          case c.data_type when 'character varying' then 'varchar' else c.data_type end,
          c.column_name, '%' || old_prefix || '%');
      end if;
    end if;
  end loop;
  raise notice 'TOTAL rows with old links: % (%)', total, case when do_apply then 'rewritten' else 'count only' end;
end $$;
commit;
