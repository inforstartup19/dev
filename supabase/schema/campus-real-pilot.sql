begin;
-- Operator-managed enrollment. Never expose email invitations through the Data API.
create table qc_private.pilot_invites (
 email text primary key check(email=lower(trim(email)) and position('@' in email)>1),
 role text not null check(role in ('student','teacher')),
 university text not null default '' check(length(university)<=180),
 supervise_all boolean not null default false,
 expires_at timestamptz not null default now()+interval '30 days',
 revoked_at timestamptz,
 accepted_by uuid references auth.users(id),
 accepted_at timestamptz
);
alter table qc_private.pilot_invites enable row level security;
revoke all on qc_private.pilot_invites from public,anon,authenticated;
create table public.qc_pilot_people (
 user_id uuid primary key references auth.users(id),
 role text not null check(role in ('student','teacher')),
 university text not null default '',
 active boolean not null default true,
 joined_at timestamptz not null default now()
);
alter table public.qc_pilot_people enable row level security;
revoke all on public.qc_pilot_people from public,anon,authenticated;
grant select on public.qc_pilot_people to authenticated;
create policy qc_pilot_self on public.qc_pilot_people for select to authenticated using(user_id=(select auth.uid()));
create function qc_private.pilot_role() returns text language sql stable security definer set search_path='' as $$
 select p.role from public.qc_pilot_people p where p.user_id=auth.uid() and p.active
 and exists(select 1 from qc_private.pilot_invites i where i.accepted_by=p.user_id and i.revoked_at is null)
$$;
revoke all on function qc_private.pilot_role() from public;
grant execute on function qc_private.pilot_role() to authenticated;
create or replace function qc_private.member_role(p uuid) returns text language sql stable security definer set search_path='' as $$
 select case when pr.owner_id=auth.uid() and qc_private.pilot_role()='student' then 'student'
 else (select m.role from public.qc_members m where m.project_id=p and m.user_id=auth.uid() and m.role=qc_private.pilot_role()) end
 from public.qc_projects pr where pr.id=p and auth.uid() is not null and qc_private.pilot_role() is not null
$$;
create function qc_private.accept_pilot() returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); address text; invitation qc_private.pilot_invites; pilot_role_value text;
begin
 if who is null then raise exception 'Authentication required'; end if;
 select lower(email) into address from auth.users where id=who and email_confirmed_at is not null and coalesce(is_anonymous,false)=false;
 if address is null then return null; end if;
 select * into invitation from qc_private.pilot_invites where email=address for update;
 if not found or invitation.revoked_at is not null or (invitation.accepted_by is null and invitation.expires_at<=now()) or (invitation.accepted_by is not null and invitation.accepted_by<>who) then return null; end if;
 if invitation.accepted_by is null then
  insert into public.qc_pilot_people(user_id,role,university) values(who,invitation.role,invitation.university) on conflict(user_id) do nothing;
  update qc_private.pilot_invites set accepted_by=who,accepted_at=now() where email=address;
  if invitation.role='teacher' and invitation.supervise_all then
   insert into public.qc_members(project_id,user_id,role) select id,who,'teacher' from public.qc_projects where owner_id<>who on conflict do nothing;
  end if;
 end if;
 pilot_role_value:=qc_private.pilot_role();
 if pilot_role_value is null then return null; end if;
 return jsonb_build_object('user_id',who,'role',pilot_role_value,'university',(select university from public.qc_pilot_people where user_id=who));
end $$;
revoke all on function qc_private.accept_pilot() from public;
grant execute on function qc_private.accept_pilot() to authenticated;
create function public.qc_accept_pilot() returns jsonb language sql security invoker set search_path='' as $$ select qc_private.accept_pilot() $$;
revoke all on function public.qc_accept_pilot() from public,anon;
grant execute on function public.qc_accept_pilot() to authenticated;

alter table public.qc_projects drop constraint qc_projects_kind_check;
alter table public.qc_projects add constraint qc_projects_kind_check check(kind in ('TFG','TFM','TR'));
alter table public.qc_projects add column university text not null default '' check(length(university)<=180),
 add column degree text not null default '' check(length(degree)<=180),
 add column objective text not null default '' check(length(objective)<=6000),
 add column methodology text not null default '' check(length(methodology)<=6000),
 add column next_step text not null default '' check(length(next_step)<=3000),
 add column revision integer not null default 0 check(revision>=0),
 add column updated_at timestamptz not null default now();
drop policy qc_project_create on public.qc_projects;
create policy qc_project_create on public.qc_projects for insert to authenticated with check(owner_id=(select auth.uid()) and (select qc_private.pilot_role())='student');
revoke insert on public.qc_projects from authenticated;
grant insert(id,owner_id,kind,title,university,degree,objective,methodology,next_step) on public.qc_projects to authenticated;
grant update(title,university,degree,objective,methodology,next_step) on public.qc_projects to authenticated;
create table public.qc_project_events (
 id bigint generated always as identity primary key,
 project_id uuid not null references public.qc_projects(id),
 actor_id uuid not null references auth.users(id),
 actor_role text not null,
 happened_at timestamptz not null default now(),
 snapshot jsonb not null
);
alter table public.qc_project_events enable row level security;
revoke all on public.qc_project_events from public,anon,authenticated;
grant select on public.qc_project_events to authenticated;
create policy qc_project_history on public.qc_project_events for select to authenticated using(qc_private.member_role(project_id) is not null);
create index qc_project_events_project_idx on public.qc_project_events(project_id,id);
create index qc_project_events_actor_idx on public.qc_project_events(actor_id);
create function qc_private.project_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1;new.updated_at:=now();return new;end $$;
revoke all on function qc_private.project_revision() from public;
create trigger qc_project_revision before update on public.qc_projects for each row execute function qc_private.project_revision();
create function qc_private.project_record() returns trigger language plpgsql security definer set search_path='' as $$
declare r text;
begin
 r:=qc_private.member_role(new.id);
 if auth.uid() is null or r is null then raise exception 'Pilot project actor required';end if;
 if TG_OP='INSERT' then
  insert into public.qc_members(project_id,user_id,role)
  select new.id,i.accepted_by,'teacher' from qc_private.pilot_invites i join public.qc_pilot_people p on p.user_id=i.accepted_by
  where i.role='teacher' and i.supervise_all and i.revoked_at is null and p.active and p.role='teacher' and i.accepted_by<>new.owner_id on conflict do nothing;
 end if;
 insert into public.qc_project_events(project_id,actor_id,actor_role,snapshot) values(new.id,auth.uid(),r,to_jsonb(new));
 return new;
end $$;
revoke all on function qc_private.project_record() from public;
create trigger qc_project_record after insert or update on public.qc_projects for each row execute function qc_private.project_record();
-- Preserve existing task workflow, additionally prevent forged teacher comments.
create function qc_private.review_author() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' and new.review_comment<>'' then raise exception 'Teacher review required';end if;
 if TG_OP='UPDATE' and new.review_comment is distinct from old.review_comment and qc_private.member_role(new.project_id)<>'teacher' then raise exception 'Teacher review required';end if;
 return new;
end $$;
revoke all on function qc_private.review_author() from public;
create trigger qc_task_review_author before insert or update on public.qc_tasks for each row execute function qc_private.review_author();

-- Deliberate, minimal excerpts for the pilot library. Private source work is never exposed.
create table public.qc_learning_proposals (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.qc_projects(id),
 owner_id uuid not null references auth.users(id),
 kind text not null check(kind in ('TFG','TFM','TR')),
 title text not null check(length(trim(title)) between 1 and 180),
 summary text not null check(length(trim(summary)) between 1 and 3000),
 learning text not null check(length(trim(learning)) between 1 and 3000),
 consent boolean not null default false,
 status text not null default 'pending' check(status in ('pending','changes','published','withdrawn')),
 review_comment text not null default '' check(length(review_comment)<=3000),
 reviewed_by uuid references auth.users(id),
 revision integer not null default 0,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table public.qc_learning_proposals enable row level security;
revoke all on public.qc_learning_proposals from public,anon,authenticated;
grant select on public.qc_learning_proposals to authenticated;
grant insert(id,project_id,owner_id,kind,title,summary,learning,consent) on public.qc_learning_proposals to authenticated;
grant update(title,summary,learning,consent,status,review_comment) on public.qc_learning_proposals to authenticated;
create policy qc_learning_read on public.qc_learning_proposals for select to authenticated using(qc_private.member_role(project_id) is not null);
create policy qc_learning_create on public.qc_learning_proposals for insert to authenticated with check(owner_id=(select auth.uid()) and qc_private.member_role(project_id)='student' and exists(select 1 from public.qc_projects p where p.id=project_id and p.owner_id=(select auth.uid())));
create policy qc_learning_edit on public.qc_learning_proposals for update to authenticated using(qc_private.member_role(project_id) is not null) with check(qc_private.member_role(project_id) is not null);
create index qc_learning_project_idx on public.qc_learning_proposals(project_id);
create index qc_learning_owner_idx on public.qc_learning_proposals(owner_id);
create index qc_learning_reviewer_idx on public.qc_learning_proposals(reviewed_by);
create function qc_private.guard_learning() returns trigger language plpgsql security invoker set search_path='' as $$
declare r text;
begin
 r:=qc_private.member_role(new.project_id);
 if r is null then raise exception 'Project access denied';end if;
 if TG_OP='INSERT' then
  if not new.consent or new.status<>'pending' or new.owner_id<>auth.uid() or new.kind<>(select kind from public.qc_projects where id=new.project_id) then raise exception 'Owner consent required';end if;
 else
  if r='teacher' then
   if (to_jsonb(new)-'status'-'review_comment')<>(to_jsonb(old)-'status'-'review_comment') then raise exception 'Only author may edit excerpt';end if;
   if new.status not in ('published','changes') or old.status not in ('pending','published') or not new.consent or trim(new.review_comment)='' then raise exception 'Review and consent required';end if;
   new.reviewed_by:=auth.uid();
  elsif new.owner_id=auth.uid() then
   if new.status='published' and (to_jsonb(new)-'title'-'summary'-'learning'-'consent')=(to_jsonb(old)-'title'-'summary'-'learning'-'consent') then new.status:='pending';end if;
   if new.status not in ('pending','withdrawn') or (new.status='pending' and not new.consent) or new.review_comment<>old.review_comment then raise exception 'Owner cannot publish';end if;
   if new.status='withdrawn' then new.consent:=false;end if;
   new.reviewed_by:=null;new.review_comment:='';
  else raise exception 'Owner required';end if;
  new.revision:=old.revision+1;
 end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function qc_private.guard_learning() from public;
create trigger qc_learning_guard before insert or update on public.qc_learning_proposals for each row execute function qc_private.guard_learning();
create function qc_private.library_feed() returns table(id uuid,title text,summary text,learning text,kind text,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select l.id,l.title,l.summary,l.learning,l.kind,l.updated_at from public.qc_learning_proposals l
 where auth.uid() is not null and qc_private.pilot_role() is not null and l.status='published' and l.consent and l.reviewed_by is not null
 order by l.updated_at desc limit 100
$$;
revoke all on function qc_private.library_feed() from public;
grant execute on function qc_private.library_feed() to authenticated;
create function public.qc_library_feed() returns table(id uuid,title text,summary text,learning text,kind text,updated_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from qc_private.library_feed() $$;
revoke all on function public.qc_library_feed() from public,anon;
grant execute on function public.qc_library_feed() to authenticated;
commit;
