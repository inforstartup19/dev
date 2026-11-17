-- Read-only public table catalog. Do not export auth rows or credentials.
select c.relname as name,
       c.relrowsecurity as rls,
       (select count(*) from pg_policy p where p.polrelid=c.oid) as policies
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;
