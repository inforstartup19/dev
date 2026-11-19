begin;

-- All current projects start without an orientation. Existing files and project
-- histories remain readable. Column-level API grants deliberately exclude these
-- fields; confirmation is a single transaction, never a client-side flag.
alter table public.qc_projects
  add column orientation_route text,
  add column orientation_first_step text,
  add column orientation_task_id uuid,
  add constraint qc_project_orientation_complete check (
    (orientation_route is null and orientation_first_step is null and orientation_task_id is null)
    or (
      orientation_route is not null
      and orientation_route in ('applied_real', 'prototype', 'literature', 'research_plan', 'empirical')
      and orientation_first_step is not null
      and char_length(btrim(orientation_first_step)) between 1 and 180
      and orientation_task_id is not null
    )
  );

-- The task id records the original card. Editing or subsequently archiving a
-- task must not revoke the student's prior orientation or block their uploads.
create function qc_private.confirm_orientation(
  p_project_id uuid, p_route text, p_first_step text, p_expected_revision integer
) returns public.qc_projects
language plpgsql security definer set search_path = '' as $$
declare
  project public.qc_projects;
  member text;
  step text := regexp_replace(p_first_step, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  card uuid;
  current_title text;
begin
  member := qc_private.member_role(p_project_id);
  if auth.uid() is null or member is null or member not in ('student', 'teacher') then
    raise exception 'Project access denied' using errcode = '42501';
  end if;
  if p_route is null or p_route not in ('applied_real', 'prototype', 'literature', 'research_plan', 'empirical')
     or step is null or char_length(step) not between 1 and 180
     or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid orientation' using errcode = '22023';
  end if;

  select p.* into strict project from public.qc_projects p where p.id = p_project_id for update;
  if project.orientation_route is null and member <> 'student' then
    raise exception 'Student confirmation required' using errcode = '42501';
  end if;
  -- A lost response must not produce another card or another revision.
  if project.orientation_route = p_route and project.orientation_first_step = step then
    return project;
  end if;
  if project.revision <> p_expected_revision then
    raise exception 'Orientation revision conflict' using errcode = '40001';
  end if;

  card := project.orientation_task_id;
  if card is null then
    insert into public.qc_tasks(project_id, title) values (project.id, step) returning id into card;
  elsif project.orientation_first_step is distinct from step then
    -- A board edit takes the task lock before the project lock. Do not wait for
    -- that lock here or overwrite a first card independently renamed on the board.
    select t.title into current_title from public.qc_tasks t
      where t.project_id = project.id and t.id = card for update nowait;
    if not found then
      insert into public.qc_tasks(project_id, title) values (project.id, step) returning id into card;
    elsif current_title <> step then
      if current_title <> project.orientation_first_step then
        raise exception 'Orientation task changed' using errcode = '40001';
      end if;
      update public.qc_tasks set title = step where id = card and project_id = project.id;
    end if;
  end if;

  update public.qc_projects set orientation_route = p_route, orientation_first_step = step,
    orientation_task_id = card where id = project.id returning * into project;
  return project;
end
$$;
revoke all on function qc_private.confirm_orientation(uuid,text,text,integer) from public, anon;
grant execute on function qc_private.confirm_orientation(uuid,text,text,integer) to authenticated;

create function public.qc_confirm_orientation(
  p_project_id uuid, p_route text, p_first_step text, p_expected_revision integer
) returns jsonb language sql security invoker set search_path = '' as $$
  select to_jsonb(p) from qc_private.confirm_orientation(p_project_id, p_route, p_first_step, p_expected_revision) as p;
$$;
revoke all on function public.qc_confirm_orientation(uuid,text,text,integer) from public, anon;
grant execute on function public.qc_confirm_orientation(uuid,text,text,integer) to authenticated;

-- These policies only narrow access. The existing qc_document_create policy
-- still checks bucket, actor ownership, file path and active project membership.
create function qc_private.document_orientation_allows_upload(object_name text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.qc_projects p
    where p.id = qc_private.document_project(object_name)
      and (p.orientation_route is not null or qc_private.member_role(p.id) = 'teacher')
  );
$$;
revoke all on function qc_private.document_orientation_allows_upload(text) from public, anon;
grant execute on function qc_private.document_orientation_allows_upload(text) to authenticated;

create policy qc_document_orientation_insert on storage.objects as restrictive
  for insert to authenticated with check (
    bucket_id <> 'qc-campus-documents' or qc_private.document_orientation_allows_upload(name)
  );
-- The pilot currently has no UPDATE policy. Retain the same condition should
-- permission for a replacement ever be introduced; this does not enable it.
create policy qc_document_orientation_update on storage.objects as restrictive
  for update to authenticated using (true) with check (
    bucket_id <> 'qc-campus-documents' or qc_private.document_orientation_allows_upload(name)
  );

notify pgrst, 'reload schema';
commit;
