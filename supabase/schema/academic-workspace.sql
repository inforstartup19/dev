-- REVIEW CANDIDATE, NOT APPLIED. Isolated Supabase DEV prototype.
-- Generate a versioned migration with the installed CLI after database validation.
-- Does not replace apps/api identity, vaults, or Alembic schema.
begin;
create schema if not exists qc_private;
revoke all on schema qc_private from public;
grant usage on schema qc_private to authenticated;

create table public.qc_projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 kind text not null check (kind in ('TFG','TFM')),
 title text not null check (length(trim(title)) between 1 and 180),
 created_at timestamptz not null default now()
);
create table public.qc_members (
 project_id uuid not null references public.qc_projects(id),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('student','teacher')),
 primary key(project_id,user_id)
);
create index qc_members_user_idx on public.qc_members(user_id,project_id);
create index qc_projects_owner_idx on public.qc_projects(owner_id);

-- The only privileged lookup. Memberships are provisioned by a trusted operator,
-- never derived from a browser profile selector or user-editable JWT metadata.
create function qc_private.member_role(p uuid) returns text
language sql stable security definer set search_path = '' as $$
 select case when pr.owner_id=auth.uid() then 'student'
 else (select m.role from public.qc_members m where m.project_id=p and m.user_id=auth.uid()) end
 from public.qc_projects pr where pr.id=p and auth.uid() is not null
$$;
revoke all on function qc_private.member_role(uuid) from public;
grant execute on function qc_private.member_role(uuid) to authenticated;

create table public.qc_tasks (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.qc_projects(id),
 title text not null check(length(trim(title)) between 1 and 180),
 why text not null default '' check(length(why)<=3000),
 how text not null default '' check(length(how)<=3000),
 deliverable text not null default '' check(length(deliverable)<=3000),
 criteria text not null default '' check(length(criteria)<=3000),
 blocker text not null default '' check(length(blocker)<=3000),
 owner_label text not null default '' check(length(owner_label)<=180),
 due date,
 milestone boolean not null default false,
 status text not null default 'prepare' check(status in ('prepare','active','review','revise','done')),
 review_comment text not null default '' check(length(review_comment)<=3000),
 revision integer not null default 0 check(revision>=0),
 unique(project_id,id)
);
create index qc_tasks_project_status_idx on public.qc_tasks(project_id,status);
create table public.qc_dependencies (
 project_id uuid not null,
 task_id uuid not null,
 prerequisite_id uuid not null,
 primary key(project_id,task_id,prerequisite_id),
 foreign key(project_id,task_id) references public.qc_tasks(project_id,id),
 foreign key(project_id,prerequisite_id) references public.qc_tasks(project_id,id),
 check(task_id<>prerequisite_id)
);
create index qc_dependencies_prerequisite_idx on public.qc_dependencies(project_id,prerequisite_id);
create table public.qc_task_events (
 id bigint generated always as identity primary key,
 project_id uuid not null references public.qc_projects(id),
 task_id uuid not null references public.qc_tasks(id),
 actor_id uuid not null references auth.users(id),
 actor_role text not null,
 happened_at timestamptz not null default now(),
 before_state jsonb,
 after_state jsonb not null
);
create index qc_task_events_project_idx on public.qc_task_events(project_id,id);
create index qc_task_events_task_idx on public.qc_task_events(task_id);
create index qc_task_events_actor_idx on public.qc_task_events(actor_id);
create table public.qc_submissions (
 task_id uuid not null references public.qc_tasks(id),
 project_id uuid not null references public.qc_projects(id),
 task_revision integer not null,
 submitted_at timestamptz not null default now(),
 submitted_by uuid not null references auth.users(id),
 snapshot jsonb not null,
 primary key(task_id,task_revision)
);
create index qc_submissions_project_idx on public.qc_submissions(project_id);
create index qc_submissions_user_idx on public.qc_submissions(submitted_by);

alter table public.qc_projects enable row level security;
alter table public.qc_members enable row level security;
alter table public.qc_tasks enable row level security;
alter table public.qc_dependencies enable row level security;
alter table public.qc_task_events enable row level security;
alter table public.qc_submissions enable row level security;

revoke all on public.qc_projects,public.qc_members,public.qc_tasks,public.qc_dependencies,public.qc_task_events,public.qc_submissions from anon,authenticated;
grant select,insert on public.qc_projects to authenticated;
grant update(title) on public.qc_projects to authenticated;
grant select on public.qc_members,public.qc_task_events,public.qc_submissions to authenticated;
grant select,insert on public.qc_tasks to authenticated;
grant update(title,why,how,deliverable,criteria,blocker,owner_label,due,milestone,status,review_comment) on public.qc_tasks to authenticated;
grant select,insert,delete on public.qc_dependencies to authenticated;

create policy qc_project_read on public.qc_projects for select to authenticated using (qc_private.member_role(id) is not null);
create policy qc_project_create on public.qc_projects for insert to authenticated with check (owner_id=(select auth.uid()));
create policy qc_project_edit on public.qc_projects for update to authenticated using(qc_private.member_role(id) is not null) with check(qc_private.member_role(id) is not null);
create policy qc_member_read on public.qc_members for select to authenticated using(user_id=(select auth.uid()));
create policy qc_task_read on public.qc_tasks for select to authenticated using(qc_private.member_role(project_id) is not null);
create policy qc_task_create on public.qc_tasks for insert to authenticated with check(qc_private.member_role(project_id) is not null);
create policy qc_task_edit on public.qc_tasks for update to authenticated using(qc_private.member_role(project_id) is not null) with check(qc_private.member_role(project_id) is not null);
create policy qc_dependency_read on public.qc_dependencies for select to authenticated using(qc_private.member_role(project_id) is not null);
create policy qc_dependency_create on public.qc_dependencies for insert to authenticated with check(qc_private.member_role(project_id) is not null);
create policy qc_dependency_delete on public.qc_dependencies for delete to authenticated using(qc_private.member_role(project_id) is not null);
create policy qc_event_read on public.qc_task_events for select to authenticated using(qc_private.member_role(project_id) is not null);
create policy qc_submission_read on public.qc_submissions for select to authenticated using(qc_private.member_role(project_id) is not null);

create function qc_private.guard_task() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r text;
begin
 r:=qc_private.member_role(new.project_id);
 if r is null then raise exception 'Project access denied'; end if;
 -- Serialize graph edits and transitions per project.
 perform 1 from public.qc_projects where id=new.project_id for update;
 if TG_OP='INSERT' then
  if new.status<>'prepare' or new.revision<>0 then raise exception 'Tasks start in prepare'; end if;
 else
  if new.id<>old.id or new.project_id<>old.project_id then raise exception 'Immutable identity'; end if;
  if old.status in ('review','done') and (to_jsonb(new)-'status'-'review_comment')<>(to_jsonb(old)-'status'-'review_comment') then raise exception 'Reopen before editing'; end if;
  if new.status<>old.status then
   if not ((old.status='prepare' and new.status='active') or (old.status='active' and new.status in ('prepare','review')) or (old.status='review' and new.status in ('revise','done')) or (old.status='revise' and new.status='active') or (old.status='done' and new.status='revise')) then raise exception 'Invalid transition'; end if;
   if old.status in ('review','done') and r<>'teacher' then raise exception 'Teacher review required'; end if;
   if new.status in ('revise','done') and trim(new.review_comment)='' then raise exception 'Explain the next step'; end if;
   if new.status in ('review','done') then
    if trim(new.blocker)<>'' or trim(new.deliverable)='' or trim(new.criteria)='' then raise exception 'Resolve blocker and agree delivery criteria'; end if;
    if exists(select 1 from public.qc_dependencies d join public.qc_tasks t on t.id=d.prerequisite_id where d.task_id=new.id and t.status<>'done') then raise exception 'Prerequisite incomplete'; end if;
   end if;
  end if;
  new.revision:=old.revision+1;
 end if;
 return new;
end $$;
revoke all on function qc_private.guard_task() from public;
create trigger qc_task_guard before insert or update on public.qc_tasks for each row execute function qc_private.guard_task();

-- Trigger-only privilege: audit rows and submitted snapshots cannot be forged by API clients.
create function qc_private.record_task() returns trigger
language plpgsql security definer set search_path='' as $$
declare r text;
begin
 r:=qc_private.member_role(new.project_id);
 if auth.uid() is null or r is null then raise exception 'Authenticated project actor required'; end if;
 insert into public.qc_task_events(project_id,task_id,actor_id,actor_role,before_state,after_state)
 values(new.project_id,new.id,auth.uid(),r,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 if TG_OP='UPDATE' and new.status='review' and old.status<>'review' then
  insert into public.qc_submissions(task_id,project_id,task_revision,submitted_by,snapshot) values(new.id,new.project_id,new.revision,auth.uid(),to_jsonb(new));
 end if;
 return new;
end $$;
revoke all on function qc_private.record_task() from public;
create trigger qc_task_record after insert or update on public.qc_tasks for each row execute function qc_private.record_task();

create function qc_private.guard_dependency() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p uuid; t uuid;
begin
 p:=case when TG_OP='DELETE' then old.project_id else new.project_id end;
 t:=case when TG_OP='DELETE' then old.task_id else new.task_id end;
 perform 1 from public.qc_projects where id=p for update;
 if exists(select 1 from public.qc_tasks where id=t and status in ('review','done')) then raise exception 'Reopen before changing dependencies'; end if;
 if TG_OP='INSERT' then
  if exists(with recursive ancestors(id) as (
   select new.prerequisite_id union
   select d.prerequisite_id from public.qc_dependencies d join ancestors a on d.task_id=a.id where d.project_id=p
  ) select 1 from ancestors where id=new.task_id) then raise exception 'Dependency cycle'; end if;
  return new;
 end if;
 return old;
end $$;
revoke all on function qc_private.guard_dependency() from public;
create trigger qc_dependency_guard before insert or delete on public.qc_dependencies for each row execute function qc_private.guard_dependency();
commit;
