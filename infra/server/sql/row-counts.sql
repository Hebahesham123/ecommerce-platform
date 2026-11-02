-- Exact row count of every table in "public". Run on Supabase (SQL editor) and on the new server,
-- then compare the two lists. They must match.
select
  table_name,
  (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
    as row_count
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
