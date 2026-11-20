begin;

-- Centre management is independent of the academic role. Only the platform
-- operator may provision a centre or appoint a manager. The pilot's former
-- free-text university fields remain descriptive rather than authoritative.
create table qc_private.universities (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  name text not null check (length(btrim(name)) between 1 and 180),
  revision integer not null default 0 check (revision >= 0)
);
alter table qc_private.universities enable row level security;
revoke all on qc_private.universities from public, anon, authenticated, service_role;
insert into qc_private.universities (id,code,name)
values ('5d52dcce-a86e-4116-a988-f557d590245f','quelcom-pilot','Universitat Quelcom');

alter table qc_private.pilot_invites
  add column person_id uuid not null default gen_random_uuid(),
  add column institution_id uuid not null default '5d52dcce-a86e-4116-a988-f557d590245f' references qc_private.universities(id),
  add column can_manage boolean not null default false,
  add unique (institution_id, person_id),
  drop constraint pilot_invites_role_check,
  add check (role in ('student','teacher','manager'));
alter table public.qc_pilot_people drop constraint qc_pilot_people_role_check,
  add check (role in ('student','teacher','manager'));
create unique index qc_invite_one_active_identity on qc_private.pilot_invites (accepted_by)
  where accepted_by is not null and revoked_at is null;
create table qc_private.university_assignments (
  institution_id uuid not null,
  teacher_id uuid not null,
  student_id uuid not null,
  mode text not null check (mode in ('supervise','evaluate','none')),
  primary key (institution_id, teacher_id, student_id),
  foreign key (institution_id, teacher_id) references qc_private.pilot_invites (institution_id,person_id),
  foreign key (institution_id, student_id) references qc_private.pilot_invites (institution_id,person_id),
  check (teacher_id <> student_id)
);
create index qc_uni_assignment_student_idx on qc_private.university_assignments (institution_id,student_id);
create table qc_private.university_assignment_events (
  institution_id uuid not null references qc_private.universities(id),
  revision integer not null,
  actor_id uuid not null references auth.users(id),
  teacher_id uuid not null,
  student_id uuid not null,
  prior_mode text not null,
  mode text not null,
  changed_at timestamptz not null default clock_timestamp(),
  primary key (institution_id,revision)
);
alter table qc_private.university_assignments enable row level security;
alter table qc_private.university_assignment_events enable row level security;
revoke all on qc_private.university_assignments,qc_private.university_assignment_events from public,anon,authenticated,service_role;

-- Bound the two old "all projects" hooks to the currently configured cohort.
-- Keep sparse project memberships at their existing scope. A supervisor
-- already missing from a project does not gain that project during migration.
insert into qc_private.university_assignments (institution_id,teacher_id,student_id,mode)
select t.institution_id,t.person_id,s.person_id,'evaluate'
from qc_private.pilot_invites t join qc_private.pilot_invites s using (institution_id)
where t.role='teacher' and t.supervise_all and s.role='student'
  and t.revoked_at is null and s.revoked_at is null
  and (t.accepted_by is not null or t.expires_at > now())
  and (s.accepted_by is not null or s.expires_at > now())
  and (t.accepted_by is null or not exists (
    select from public.qc_projects pr where pr.owner_id=s.accepted_by and not exists (
      select from public.qc_members m where m.project_id=pr.id and m.user_id=t.accepted_by and m.role='teacher'
    )
  ));
update qc_private.pilot_invites set supervise_all=false where supervise_all;

-- Active authenticated identity or a currently valid invitation on the roster.
-- This internal view has no direct grants to browser roles.
create view qc_private.university_people with (security_invoker=true) as
select i.institution_id,i.person_id,i.email,i.role,i.accepted_by,i.can_manage,
       case when i.accepted_by is null then 'invited' else 'active' end as status
from qc_private.pilot_invites i
left join public.qc_pilot_people p on p.user_id=i.accepted_by and p.role=i.role
where i.revoked_at is null and
 ((i.accepted_by is null and i.expires_at > now()) or (i.accepted_by is not null and p.active));
revoke all on qc_private.university_people from public, anon, authenticated, service_role;

create or replace function qc_private.pilot_role() returns text
language sql stable security definer set search_path='' as $$
  select i.role from qc_private.university_people i
  where i.accepted_by=auth.uid() and i.role in ('student','teacher')
$$;

create or replace function qc_private.accept_pilot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  who uuid := auth.uid();
  address text;
  invitation qc_private.pilot_invites;
  centre qc_private.universities;
begin
  if who is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select lower(email) into address from auth.users
   where id=who and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if address is null then return null; end if;
  select * into invitation from qc_private.pilot_invites where email=address for update;
  if not found or invitation.revoked_at is not null
    or (invitation.role='manager' and not invitation.can_manage)
    or (invitation.accepted_by is null and invitation.expires_at<=now())
    or (invitation.accepted_by is not null and invitation.accepted_by<>who) then return null; end if;
  select * into strict centre from qc_private.universities where id=invitation.institution_id;
  if invitation.accepted_by is null then
    if exists(select from qc_private.pilot_invites where accepted_by=who and revoked_at is null) then return null; end if;
    insert into public.qc_pilot_people(user_id,role,university)
      values(who,invitation.role,centre.name) on conflict(user_id) do nothing;
    if not exists (select from public.qc_pilot_people where user_id=who and role=invitation.role and active) then return null; end if;
    update qc_private.pilot_invites set accepted_by=who,accepted_at=now() where email=address;
  end if;
  if not exists(select from qc_private.university_people where accepted_by=who) then return null; end if;
  return jsonb_build_object('user_id',who,'role',invitation.role,'university',centre.name,
    'institution',jsonb_build_object('id',centre.id,'name',centre.name,'can_manage',invitation.can_manage));
end $$;

create or replace function qc_private.project_record() returns trigger
language plpgsql security definer set search_path='' as $$
declare r text := qc_private.member_role(new.id);
begin
  if auth.uid() is null or r is null then raise exception 'Pilot project actor required';end if;
  insert into public.qc_project_events(project_id,actor_id,actor_role,snapshot) values(new.id,auth.uid(),r,to_jsonb(new));
  return new;
end $$;

-- Resolve one actor's actual access for all project-backed paths, including
-- the document analysis service which supplies its separately verified actor.
create function qc_private.university_project_access(p_project_id uuid,p_actor uuid) returns text
language sql stable security invoker set search_path='' as $$
  select case
    when a.role='student' and (pr.owner_id=p_actor or m.role='student') then 'student'
    when a.role='teacher' and pr.owner_id<>p_actor then
      case when rel.mode='none' then null
           when rel.mode is not null then rel.mode
           when m.role='teacher' then 'evaluate' end
    end
  from public.qc_projects pr
  join qc_private.university_people owner_person on owner_person.accepted_by=pr.owner_id and owner_person.role='student'
  join qc_private.university_people a on a.accepted_by=p_actor and a.institution_id=owner_person.institution_id
  left join public.qc_members m on m.project_id=pr.id and m.user_id=p_actor
  left join qc_private.university_assignments rel on rel.institution_id=a.institution_id
    and rel.teacher_id=a.person_id and rel.student_id=owner_person.person_id
  where pr.id=p_project_id
$$;
revoke all on function qc_private.university_project_access(uuid,uuid) from public, anon, authenticated, service_role;
create or replace function qc_private.member_role(p uuid) returns text
language sql stable security definer set search_path='' as $$
  select case qc_private.university_project_access(p,auth.uid())
    when 'student' then 'student' when 'evaluate' then 'teacher' when 'supervise' then 'teacher' end
$$;
create or replace function qc_private.document_review_actor(p_project_id uuid,p_actor_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select qc_private.university_project_access(p_project_id,p_actor_id) is not null
$$;
alter policy qc_member_read on public.qc_members using(user_id=(select auth.uid()) and qc_private.member_role(project_id)=role);

create function qc_private.can_evaluate(p_project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(qc_private.university_project_access(p_project_id,auth.uid())='evaluate',false)
$$;
revoke all on function qc_private.can_evaluate(uuid) from public,anon;
grant execute on function qc_private.can_evaluate(uuid) to authenticated;
create function public.qc_can_evaluate(p_project_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$ select qc_private.can_evaluate(p_project_id) $$;
revoke all on function public.qc_can_evaluate(uuid) from public,anon;
grant execute on function public.qc_can_evaluate(uuid) to authenticated;

-- Serialize evaluation with a manager's permission change on the same centre.
create function qc_private.require_university_evaluator(p_project_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform u.id from qc_private.universities u join qc_private.university_people a on a.institution_id=u.id
   where a.accepted_by=auth.uid() and a.role='teacher' for share of u;
  if not found or not qc_private.can_evaluate(p_project_id) then
    raise exception 'Assigned evaluator required' using errcode='42501'; end if;
end $$;
revoke all on function qc_private.require_university_evaluator(uuid) from public,anon,authenticated,service_role;
create function qc_private.university_evaluation_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='qc_tasks' then
    if (old.status in ('review','done') and new.status<>old.status) or new.review_comment is distinct from old.review_comment then
      perform qc_private.require_university_evaluator(new.project_id);
    end if;
  elsif qc_private.member_role(new.project_id)='teacher' then
    perform qc_private.require_university_evaluator(new.project_id);
  end if;
  return new;
end $$;
revoke all on function qc_private.university_evaluation_guard() from public,anon,authenticated,service_role;
create trigger qc_evaluation_permission before update on public.qc_tasks
for each row execute function qc_private.university_evaluation_guard();
create trigger qc_evaluation_permission before update on public.qc_learning_proposals
for each row execute function qc_private.university_evaluation_guard();

-- Reuse the original rehearsal transition/retry logic only after a fresh
-- evaluator check. The unguarded implementation can no longer be invoked.
alter function qc_private.defense_save(uuid,integer,text,text,text,text,integer,integer,text) rename to defense_save_internal;
revoke all on function qc_private.defense_save_internal(uuid,integer,text,text,text,text,integer,integer,text) from public,anon,authenticated,service_role;
create function qc_private.defense_save(
  p_project_id uuid,p_revision integer,p_action text,p_outline text,p_questions text,p_attachment text,
  p_talk_minutes integer,p_question_minutes integer,p_feedback text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_action in ('return','validate') then perform qc_private.require_university_evaluator(p_project_id); end if;
  return qc_private.defense_save_internal(p_project_id,p_revision,p_action,p_outline,p_questions,p_attachment,
    p_talk_minutes,p_question_minutes,p_feedback);
end $$;
revoke all on function qc_private.defense_save(uuid,integer,text,text,text,text,integer,integer,text) from public,anon;
grant execute on function qc_private.defense_save(uuid,integer,text,text,text,text,integer,integer,text) to authenticated;

-- Legacy one-project permissions remain visible to the manager without
-- becoming a grant for every project of that student.
create view qc_private.university_links with (security_invoker=true) as
select t.institution_id,t.person_id as teacher_id,s.person_id as student_id,r.mode
from qc_private.university_assignments r
join qc_private.university_people t on t.institution_id=r.institution_id and t.person_id=r.teacher_id and t.role='teacher'
join qc_private.university_people s on s.institution_id=r.institution_id and s.person_id=r.student_id and s.role='student'
where r.mode <> 'none'
union all
select distinct t.institution_id,t.person_id,s.person_id,'project_only'::text
from public.qc_members m join public.qc_projects p on p.id=m.project_id
join qc_private.university_people t on m.role='teacher' and t.role='teacher' and t.accepted_by=m.user_id
join qc_private.university_people s on s.role='student' and s.accepted_by=p.owner_id and s.institution_id=t.institution_id
where not exists(select from qc_private.university_assignments r
  where r.institution_id=t.institution_id and r.teacher_id=t.person_id and r.student_id=s.person_id);
revoke all on qc_private.university_links from public,anon,authenticated,service_role;

create function qc_private.university_roster() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare centre qc_private.universities;
begin
  select u.* into centre from qc_private.universities u join qc_private.university_people a
    on a.institution_id=u.id where a.accepted_by=auth.uid() and a.can_manage;
  if not found then raise exception 'University manager required' using errcode='42501'; end if;
  return (with directory as (
    select p.role,jsonb_agg(jsonb_build_object('id',p.person_id,'label',p.email,'status',p.status) order by p.email,p.person_id) as people
    from qc_private.university_people p where p.institution_id=centre.id and p.role in ('student','teacher') group by p.role
  )
  select jsonb_build_object('institution',jsonb_build_object('id',centre.id,'name',centre.name),'revision',centre.revision,
    'teachers',coalesce((select people from directory where role='teacher'),'[]'::jsonb),
    'students',coalesce((select people from directory where role='student'),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('teacher_id',l.teacher_id,'student_id',l.student_id,'mode',l.mode)
      order by l.teacher_id,l.student_id) from qc_private.university_links l where l.institution_id=centre.id),'[]'::jsonb)));
end $$;
revoke all on function qc_private.university_roster() from public,anon;
grant execute on function qc_private.university_roster() to authenticated;
create function public.qc_university_roster() returns jsonb
language sql stable security invoker set search_path='' as $$ select qc_private.university_roster() $$;
revoke all on function public.qc_university_roster() from public,anon;
grant execute on function public.qc_university_roster() to authenticated;

create function qc_private.university_my_assignments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me qc_private.university_people;
begin
  select * into me from qc_private.university_people where accepted_by=auth.uid();
  if not found then raise exception 'University membership required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.person_id,'label',split_part(p.email,'@',1),
    'mode',l.mode,'role',p.role,'status',p.status) order by p.email,p.person_id)
    from qc_private.university_links l join qc_private.university_people p on p.institution_id=l.institution_id and
      ((me.role='student' and l.student_id=me.person_id and p.person_id=l.teacher_id) or
       (me.role='teacher' and l.teacher_id=me.person_id and p.person_id=l.student_id))
    where l.institution_id=me.institution_id and p.status='active'),'[]'::jsonb);
end $$;
revoke all on function qc_private.university_my_assignments() from public,anon;
grant execute on function qc_private.university_my_assignments() to authenticated;
create function public.qc_university_my_assignments() returns jsonb
language sql stable security invoker set search_path='' as $$ select qc_private.university_my_assignments() $$;
revoke all on function public.qc_university_my_assignments() from public,anon;
grant execute on function public.qc_university_my_assignments() to authenticated;

create function qc_private.university_set_assignment(p_teacher_id uuid,p_student_id uuid,p_mode text,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare centre qc_private.universities; prior text;
begin
  -- The institution comes from the authenticated appointment, never the client.
  select u.* into centre from qc_private.universities u join qc_private.university_people a on a.institution_id=u.id
    where a.accepted_by=auth.uid() and a.can_manage for update of u;
  if not found or not exists(select from qc_private.university_people where accepted_by=auth.uid() and can_manage and institution_id=centre.id) then
    raise exception 'University manager required' using errcode='42501'; end if;
  if p_mode is null or p_mode not in ('none','supervise','evaluate') or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Invalid assignment' using errcode='22023'; end if;
  if not exists(select from qc_private.university_people where person_id=p_teacher_id and institution_id=centre.id and role='teacher')
     or not exists(select from qc_private.university_people where person_id=p_student_id and institution_id=centre.id and role='student') then
    raise exception 'Unavailable university participants' using errcode='42501'; end if;
  if p_expected_revision<>centre.revision then
    if p_expected_revision::bigint+1=centre.revision and exists(select from qc_private.university_assignment_events e
      where e.institution_id=centre.id and e.revision=centre.revision and e.actor_id=auth.uid()
        and e.teacher_id=p_teacher_id and e.student_id=p_student_id and e.mode=p_mode) then
      return qc_private.university_roster(); end if;
    raise exception 'Assignment revision conflict' using errcode='40001'; end if;
  select mode into prior from qc_private.university_links l
    where l.institution_id=centre.id and l.teacher_id=p_teacher_id and l.student_id=p_student_id;
  prior:=coalesce(prior,'none');
  if prior=p_mode then return qc_private.university_roster(); end if;
  insert into qc_private.university_assignments(institution_id,teacher_id,student_id,mode)
    values(centre.id,p_teacher_id,p_student_id,p_mode)
    on conflict(institution_id,teacher_id,student_id) do update set mode=excluded.mode;
  update qc_private.universities set revision=revision+1 where id=centre.id returning revision into centre.revision;
  insert into qc_private.university_assignment_events(institution_id,revision,actor_id,teacher_id,student_id,prior_mode,mode)
    values(centre.id,centre.revision,auth.uid(),p_teacher_id,p_student_id,prior,p_mode);
  return qc_private.university_roster();
end $$;
revoke all on function qc_private.university_set_assignment(uuid,uuid,text,integer) from public,anon;
grant execute on function qc_private.university_set_assignment(uuid,uuid,text,integer) to authenticated;
create function public.qc_university_set_assignment(p_teacher_id uuid,p_student_id uuid,p_mode text,p_expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$
  select qc_private.university_set_assignment(p_teacher_id,p_student_id,p_mode,p_expected_revision)
$$;
revoke all on function public.qc_university_set_assignment(uuid,uuid,text,integer) from public,anon;
grant execute on function public.qc_university_set_assignment(uuid,uuid,text,integer) to authenticated;

-- Neither operation below is exposed through a public RPC or a client key.
-- The platform operator runs them as a privileged database operator. A new
-- centre must be explicitly selected on future invitations.
create function qc_private.operator_create_university(p_code text,p_name text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare centre qc_private.universities;
begin
  insert into qc_private.universities(code,name) values(p_code,btrim(p_name)) on conflict(code) do nothing;
  select * into strict centre from qc_private.universities where code=p_code;
  if centre.name is distinct from btrim(p_name) then raise exception 'University code already in use' using errcode='23505'; end if;
  return centre.id;
end $$;
revoke all on function qc_private.operator_create_university(text,text) from public,anon,authenticated,service_role;

create function qc_private.operator_set_manager(p_institution_id uuid,p_email text,p_enabled boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare person qc_private.pilot_invites;
begin
  if p_enabled is null then raise exception 'Choose appointment or revocation' using errcode='22023'; end if;
  perform id from qc_private.universities where id=p_institution_id for update;
  select * into person from qc_private.pilot_invites where institution_id=p_institution_id and email=lower(btrim(p_email)) for update;
  if not found or (p_enabled and not exists(select from qc_private.university_people where institution_id=p_institution_id and person_id=person.person_id)) then
    raise exception 'Eligible invitation in this university required' using errcode='22023'; end if;
  update qc_private.pilot_invites set can_manage=p_enabled where institution_id=p_institution_id and person_id=person.person_id;
end $$;
revoke all on function qc_private.operator_set_manager(uuid,text,boolean) from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
