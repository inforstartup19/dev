-- Disposable DB only. Requires the paired .before fixture loaded pre-upgrade.
begin;
do $$
declare
 teacher uuid := (select who from upgrade_people where k='full');
 scoped uuid := (select who from upgrade_people where k='specific');
 first_work uuid := (select id from upgrade_works where k='one');
 second_work uuid := (select id from upgrade_works where k='two');
 excluded_work uuid := (select id from upgrade_works where k='three');
begin
 if exists(select from qc_private.pilot_invites where supervise_all or can_manage) then raise exception 'FAIL legacy global or implicit manager'; end if;
 if qc_private.university_project_access(first_work,teacher) is distinct from 'evaluate'
   or qc_private.university_project_access(second_work,teacher) is distinct from 'evaluate'
   or qc_private.university_project_access(excluded_work,teacher) is not null then raise exception 'FAIL sparse legacy global tutor was widened or lost'; end if;
 if qc_private.university_project_access(first_work,scoped) is not null
   or qc_private.university_project_access(second_work,scoped) is distinct from 'evaluate'
   or qc_private.university_project_access(excluded_work,scoped) is not null then raise exception 'FAIL sparse explicit project assignment'; end if;
 if (select count(*) from qc_private.university_links l join qc_private.pilot_invites p on l.teacher_id=p.person_id
     where p.email=(select who||'@example.invalid' from upgrade_people where k='pending') and l.mode='evaluate')<>2 then
   raise exception 'FAIL pending old invitation lost existing cohort'; end if;
 if not exists(select from qc_private.university_links l join qc_private.pilot_invites p on l.teacher_id=p.person_id
     where p.accepted_by=scoped and l.mode='project_only') then raise exception 'FAIL hidden project-specific access'; end if;
end $$;
-- Newly enrolled students are not included even with historical teacher flags.
insert into auth.users(id,email,email_confirmed_at) values ('37b0630e-f663-4056-8528-ab3be0430c1d','new-student@example.invalid',now());
insert into qc_private.pilot_invites(email,role) values ('new-student@example.invalid','student');
set local role authenticated;
select set_config('request.jwt.claim.sub','37b0630e-f663-4056-8528-ab3be0430c1d',true);
select public.qc_accept_pilot();
insert into public.qc_projects(id,owner_id,title,kind) values('e83cb779-eefe-4933-ad5b-d6c645a2939a',auth.uid(),'New student work','TR');
reset role;
do $$
begin
 if exists (select from upgrade_people p where p.k in('full','specific') and qc_private.university_project_access(
   'e83cb779-eefe-4933-ad5b-d6c645a2939a',p.who) is not null) then raise exception 'FAIL student was automatically assigned after cutover'; end if;
end $$;
rollback;
