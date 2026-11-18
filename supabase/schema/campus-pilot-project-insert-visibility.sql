-- Owner predicate must not depend on re-selecting the row being inserted.
drop policy qc_project_read on public.qc_projects;
create policy qc_project_read on public.qc_projects for select to authenticated
using ((owner_id=(select auth.uid()) and (select qc_private.pilot_role())='student') or qc_private.member_role(id) is not null);
