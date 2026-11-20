-- Run against isolated DEV. Every fixture is rolled back, including auth users.
begin;
select set_config('test.student',gen_random_uuid()::text,true),
       set_config('test.teacher',gen_random_uuid()::text,true),
       set_config('test.outsider',gen_random_uuid()::text,true),
       set_config('test.project',gen_random_uuid()::text,true),
       set_config('test.task',gen_random_uuid()::text,true),
       set_config('test.other_task',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) select current_setting('test.'||k)::uuid,current_setting('test.'||k)||'@example.test',now() from unnest(array['student','teacher','outsider']) k;
insert into qc_private.pilot_invites(email,role) values(current_setting('test.student')||'@example.test','student'),(current_setting('test.teacher')||'@example.test','teacher');
select set_config('request.jwt.claim.sub',current_setting('test.teacher'),true);
select public.qc_accept_pilot();
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
select public.qc_accept_pilot();
insert into public.qc_projects(id,owner_id,kind,title) values(current_setting('test.project')::uuid,current_setting('test.student')::uuid,'TFG','Transient RLS test');
insert into public.qc_members(project_id,user_id,role) values(current_setting('test.project')::uuid,current_setting('test.teacher')::uuid,'teacher');
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
insert into public.qc_tasks(id,project_id,title,deliverable,criteria) values(current_setting('test.task')::uuid,current_setting('test.project')::uuid,'First proof','Report','Reproducible');
update public.qc_tasks set status='active' where id=current_setting('test.task')::uuid;
update public.qc_tasks set status='review' where id=current_setting('test.task')::uuid;
do $$begin
 if (select count(*) from public.qc_submissions)<>1 then raise exception 'FAIL snapshot missing'; end if;
 begin
  update public.qc_tasks set status='done',review_comment='Self approval' where id=current_setting('test.task')::uuid;
  raise exception 'FAIL self approval allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.qc_members(project_id,user_id,role) values(current_setting('test.project')::uuid,current_setting('test.student')::uuid,'teacher');
  raise exception 'FAIL self promotion allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.qc_submissions set snapshot='{}'::jsonb;
  raise exception 'FAIL snapshot mutation allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.outsider'),true);
do $$begin
 if exists(select 1 from public.qc_projects) or exists(select 1 from public.qc_tasks) or exists(select 1 from public.qc_submissions) or exists(select 1 from public.qc_task_events) then raise exception 'FAIL outsider can read project'; end if;
 update public.qc_tasks set title='Unauthorized' where id=current_setting('test.task')::uuid;
 if found then raise exception 'FAIL outsider can update'; end if;
 begin
  insert into public.qc_tasks(project_id,title) values(current_setting('test.project')::uuid,'Unauthorized');
  raise exception 'FAIL outsider can insert';
 exception when raise_exception then if SQLERRM<>'Project access denied' then raise; end if;
 when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.teacher'),true);
update public.qc_tasks set status='revise',review_comment='Add controls to the method' where id=current_setting('test.task')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
update public.qc_tasks set deliverable='Report v2' where id=current_setting('test.task')::uuid;
update public.qc_tasks set status='active' where id=current_setting('test.task')::uuid;
update public.qc_tasks set status='review' where id=current_setting('test.task')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.teacher'),true);
update public.qc_tasks set status='done',review_comment='Controls verified' where id=current_setting('test.task')::uuid;
do $$begin
 if (select count(*) from public.qc_submissions)<>2 then raise exception 'FAIL second snapshot missing'; end if;
 if not exists(select 1 from public.qc_submissions where snapshot->>'deliverable'='Report') then raise exception 'FAIL original changed'; end if;
 update public.qc_tasks set title='Stale update' where id=current_setting('test.task')::uuid and revision=0;
 if found then raise exception 'FAIL stale revision updated'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true);
insert into public.qc_tasks(id,project_id,title) values(current_setting('test.other_task')::uuid,current_setting('test.project')::uuid,'Second proof');
insert into public.qc_dependencies(project_id,task_id,prerequisite_id) values(current_setting('test.project')::uuid,current_setting('test.other_task')::uuid,current_setting('test.task')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.teacher'),true);
update public.qc_tasks set status='revise',review_comment='Reopen for dependency test' where id=current_setting('test.task')::uuid;
do $$begin
 begin
  insert into public.qc_dependencies(project_id,task_id,prerequisite_id) values(current_setting('test.project')::uuid,current_setting('test.task')::uuid,current_setting('test.other_task')::uuid);
  raise exception 'FAIL cycle allowed';
 exception when raise_exception then if SQLERRM<>'Dependency cycle' then raise; end if; end;
end $$;
reset role;
select 'PASS: role isolation, transitions, immutable snapshots, optimistic revision and dependency cycle' as result;
rollback;
