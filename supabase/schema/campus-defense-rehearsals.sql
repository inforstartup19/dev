begin;

-- One private, formative rehearsal per project. Official deposits, marks and
-- examination-board appointments are outside this workflow.
create table public.qc_defense_rehearsals (
  project_id uuid primary key references public.qc_projects(id) on delete cascade,
  revision integer not null check (revision > 0),
  status text not null check (status in ('draft','submitted','changes_requested','rehearsed')),
  outline text not null check (char_length(outline) <= 6000),
  questions text not null check (char_length(questions) <= 3000),
  attachment text,
  talk_minutes integer not null check (talk_minutes between 1 and 120),
  question_minutes integer not null check (question_minutes between 0 and 120),
  feedback text not null check (char_length(feedback) <= 3000),
  updated_at timestamptz not null,
  last_action text not null check (last_action in ('save','submit','return','validate')),
  changed_by uuid not null
);
alter table public.qc_defense_rehearsals enable row level security;
revoke all on public.qc_defense_rehearsals from public, anon, authenticated;

-- Only RPCs can write. Retain the exact submitted and reviewed snapshots.
-- Ordinary draft saves replace the draft; they do not duplicate private text
-- in the journal. Project deletion also removes the associated rehearsal.
create table qc_private.defense_rehearsal_events (
  project_id uuid not null references public.qc_defense_rehearsals(project_id) on delete cascade,
  revision integer not null,
  action text not null check (action in ('submit','return','validate')),
  actor uuid not null,
  snapshot jsonb not null,
  primary key (project_id, revision)
);
alter table qc_private.defense_rehearsal_events enable row level security;
revoke all on qc_private.defense_rehearsal_events from public, anon, authenticated;

-- An enrolled project member can be an additional student in the base
-- schema. Only the actual student owner and an assigned teacher take part
-- in this rehearsal. Reuse the pilot's active invitation/membership lookup.
create function qc_private.defense_role(p_project_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select case
    when p.owner_id = auth.uid() and qc_private.member_role(p.id) = 'student' then 'student'
    when p.owner_id <> auth.uid() and qc_private.member_role(p.id) = 'teacher' then 'teacher'
  end
  from public.qc_projects p where p.id = p_project_id
$$;
revoke all on function qc_private.defense_role(uuid) from public, anon, authenticated;

create function qc_private.defense_get(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  member text := qc_private.defense_role(p_project_id);
begin
  if member is null then
    raise exception 'Project access denied' using errcode = '42501';
  end if;
  if member = 'teacher' then
    -- The student chooses when to send each version to tutoring. A future
    -- draft cannot replace the last snapshot available to the tutor.
    return (select e.snapshot from qc_private.defense_rehearsal_events e
            where e.project_id = p_project_id order by e.revision desc limit 1);
  end if;
  return (select to_jsonb(r) - 'changed_by' - 'last_action'
          from public.qc_defense_rehearsals r where r.project_id = p_project_id);
end
$$;
revoke all on function qc_private.defense_get(uuid) from public, anon;
grant execute on function qc_private.defense_get(uuid) to authenticated;

create function public.qc_defense_get(p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select qc_private.defense_get(p_project_id)
$$;
revoke all on function public.qc_defense_get(uuid) from public, anon;
grant execute on function public.qc_defense_get(uuid) to authenticated;

create function qc_private.defense_save(
  p_project_id uuid, p_revision integer, p_action text, p_outline text,
  p_questions text, p_attachment text, p_talk_minutes integer,
  p_question_minutes integer, p_feedback text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  member text;
  last public.qc_defense_rehearsals;
  new_status text;
  outline_value text := coalesce(p_outline, '');
  questions_value text := coalesce(p_questions, '');
  attachment_value text := nullif(p_attachment, '');
  feedback_value text := coalesce(p_feedback, '');
  result jsonb;
begin
  member := qc_private.defense_role(p_project_id);
  if member is null then
    raise exception 'Project access denied' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('save','submit','return','validate')
     or p_revision is null or p_revision < 0 then
    raise exception 'Invalid rehearsal action or revision' using errcode = '22023';
  end if;
  if (member = 'student') <> (p_action in ('save','submit')) then
    raise exception 'Action unavailable to this role' using errcode = '42501';
  end if;

  -- Locking the parent serializes the initial insert as well as later
  -- concurrent edits, without creating a row merely by opening the room.
  perform 1 from public.qc_projects where id = p_project_id for update;
  if not found or qc_private.defense_role(p_project_id) is distinct from member then
    raise exception 'Project access denied' using errcode = '42501';
  end if;
  select * into last from public.qc_defense_rehearsals where project_id = p_project_id;

  -- A repeated request after a lost response is successful only for the same
  -- actor, base revision, action and effective fields, with no intervening edit.
  if last.revision::bigint = p_revision::bigint + 1
     and last.last_action = p_action and last.changed_by = auth.uid() and
     ((member = 'student' and last.outline = outline_value
       and last.questions = questions_value and last.attachment is not distinct from attachment_value
       and last.talk_minutes = p_talk_minutes and last.question_minutes = p_question_minutes)
      or (member = 'teacher' and last.feedback = feedback_value)) then
    return to_jsonb(last) - 'changed_by' - 'last_action';
  end if;
  if coalesce(last.revision, 0) <> p_revision then
    raise exception 'Rehearsal revision conflict' using errcode = '40001';
  end if;

  if member = 'student' then
    if last.status = 'submitted' or (last.status = 'rehearsed' and p_action <> 'save') then
      raise exception 'Rehearsal cannot change in this state' using errcode = '22023';
    end if;
    if char_length(outline_value) > 6000 or char_length(questions_value) > 3000
       or p_talk_minutes is null or p_talk_minutes not between 1 and 120
       or p_question_minutes is null or p_question_minutes not between 0 and 120
       or (p_action = 'submit' and outline_value !~ '[^[:space:]]') then
      raise exception 'Invalid rehearsal content or timing' using errcode = '22023';
    end if;
    if attachment_value is not null and (
      char_length(attachment_value) > 512 or position('/' in attachment_value) > 0
      or attachment_value !~ '\.(pdf|ppt|pptx)$'
      or qc_private.document_project(p_project_id::text || '/' || attachment_value) is distinct from p_project_id
      or not exists (select 1 from storage.objects o where o.bucket_id = 'qc-campus-documents'
                     and o.name = p_project_id::text || '/' || attachment_value)
    ) then
      raise exception 'Select a document from this project' using errcode = '22023';
    end if;
    new_status := case when p_action = 'submit' then 'submitted' else 'draft' end;
    feedback_value := coalesce(last.feedback, '');
  else
    if last.status is distinct from 'submitted' or feedback_value !~ '[^[:space:]]'
       or char_length(feedback_value) > 3000 then
      raise exception 'A submitted rehearsal and tutor feedback are required' using errcode = '22023';
    end if;
    -- Reviewer parameters never replace the student's version.
    outline_value := last.outline;
    questions_value := last.questions;
    attachment_value := last.attachment;
    p_talk_minutes := last.talk_minutes;
    p_question_minutes := last.question_minutes;
    new_status := case when p_action = 'return' then 'changes_requested' else 'rehearsed' end;
  end if;

  insert into public.qc_defense_rehearsals (
    project_id, revision, status, outline, questions, attachment, talk_minutes,
    question_minutes, feedback, updated_at, last_action, changed_by
  ) values (
    p_project_id, p_revision + 1, new_status, outline_value, questions_value, attachment_value,
    p_talk_minutes, p_question_minutes, feedback_value, clock_timestamp(), p_action, auth.uid()
  ) on conflict (project_id) do update set
    revision=excluded.revision, status=excluded.status, outline=excluded.outline, questions=excluded.questions,
    attachment=excluded.attachment, talk_minutes=excluded.talk_minutes, question_minutes=excluded.question_minutes,
    feedback=excluded.feedback, updated_at=excluded.updated_at, last_action=excluded.last_action, changed_by=excluded.changed_by
  returning * into last;
  result := to_jsonb(last) - 'changed_by' - 'last_action';
  if p_action <> 'save' then
    insert into qc_private.defense_rehearsal_events (project_id, revision, action, actor, snapshot)
      values (p_project_id, last.revision, p_action, auth.uid(), result);
  end if;
  return result;
end
$$;
revoke all on function qc_private.defense_save(uuid,integer,text,text,text,text,integer,integer,text) from public, anon;
grant execute on function qc_private.defense_save(uuid,integer,text,text,text,text,integer,integer,text) to authenticated;

create function public.qc_defense_save(
  p_project_id uuid, p_revision integer, p_action text, p_outline text,
  p_questions text, p_attachment text, p_talk_minutes integer,
  p_question_minutes integer, p_feedback text
) returns jsonb language sql security invoker set search_path = '' as $$
  select qc_private.defense_save(p_project_id,p_revision,p_action,p_outline,p_questions,
                                 p_attachment,p_talk_minutes,p_question_minutes,p_feedback)
$$;
revoke all on function public.qc_defense_save(uuid,integer,text,text,text,text,integer,integer,text) from public, anon;
grant execute on function public.qc_defense_save(uuid,integer,text,text,text,text,integer,integer,text) to authenticated;

notify pgrst, 'reload schema';
commit;
