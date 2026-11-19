begin;
select set_config('test.s',gen_random_uuid()::text,true),set_config('test.t',gen_random_uuid()::text,true),set_config('test.o',gen_random_uuid()::text,true),set_config('test.n',gen_random_uuid()::text,true),set_config('test.p',gen_random_uuid()::text,true),set_config('test.task',gen_random_uuid()::text,true),set_config('test.l',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) select current_setting('test.'||k)::uuid,current_setting('test.'||k)||'@example.test',now() from unnest(array['s','t','o','n']) k;
insert into qc_private.pilot_invites(email,role,supervise_all) values(current_setting('test.s')||'@example.test','student',false),(current_setting('test.t')||'@example.test','teacher',true),(current_setting('test.o')||'@example.test','student',false);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.n'),true);
do $$begin if public.qc_accept_pilot() is not null then raise exception 'FAIL uninvited enrollment';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('test.s'),true);
do $$begin if public.qc_accept_pilot()->>'role'<>'student' then raise exception 'FAIL student enrollment';end if;end $$;
insert into public.qc_projects(id,owner_id,kind,title,objective) values(current_setting('test.p')::uuid,current_setting('test.s')::uuid,'TR','Synthetic pilot test','Private research goal') returning id;
update public.qc_projects set objective='Private goal v2' where id=current_setting('test.p')::uuid and revision=0;
do $$begin if (select revision from public.qc_projects where id=current_setting('test.p')::uuid)<>1 then raise exception 'FAIL revision';end if;
 update public.qc_projects set objective='Stale overwrite' where id=current_setting('test.p')::uuid and revision=0;
 if found then raise exception 'FAIL stale overwrite';end if;
 begin update public.qc_pilot_people set role='teacher' where user_id=auth.uid();raise exception 'FAIL self promote';exception when insufficient_privilege then null;end;
end $$;
insert into public.qc_tasks(id,project_id,title,deliverable,criteria) values(current_setting('test.task')::uuid,current_setting('test.p')::uuid,'Independent task','Evidence','Agreed criteria');
update public.qc_tasks set status='active' where id=current_setting('test.task')::uuid;
update public.qc_tasks set status='review' where id=current_setting('test.task')::uuid;
do $$begin
 begin update public.qc_tasks set review_comment='Forged review' where id=current_setting('test.task')::uuid;raise exception 'FAIL forged review';exception when raise_exception then if SQLERRM<>'Teacher review required' then raise;end if;end;
 begin update public.qc_tasks set status='done',review_comment='Self approval' where id=current_setting('test.task')::uuid;raise exception 'FAIL self approval';exception when raise_exception then if SQLERRM<>'Teacher review required' then raise;end if;end;
end $$;
insert into public.qc_learning_proposals(id,project_id,owner_id,kind,title,summary,learning,consent) values(current_setting('test.l')::uuid,current_setting('test.p')::uuid,auth.uid(),'TR','Safe excerpt','Anonymized summary','Reusable learning',true);
select set_config('request.jwt.claim.sub',current_setting('test.t'),true);
do $$begin if public.qc_accept_pilot()->>'role'<>'teacher' then raise exception 'FAIL teacher enrollment';end if;if not exists(select 1 from public.qc_projects where id=current_setting('test.p')::uuid) then raise exception 'FAIL assignment';end if;end $$;
update public.qc_tasks set status='done',review_comment='Evidence reviewed' where id=current_setting('test.task')::uuid;
update public.qc_learning_proposals set status='published',review_comment='Safe for the pilot library' where id=current_setting('test.l')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.o'),true);
select public.qc_accept_pilot();
do $$begin
 if exists(select 1 from public.qc_projects where id=current_setting('test.p')::uuid) or exists(select 1 from public.qc_learning_proposals where id=current_setting('test.l')::uuid) then raise exception 'FAIL private work leak';end if;
 if not exists(select 1 from public.qc_library_feed() where id=current_setting('test.l')::uuid) then raise exception 'FAIL approved excerpt absent';end if;
 update public.qc_projects set title='Unauthorized edit' where id=current_setting('test.p')::uuid;if found then raise exception 'FAIL outsider write';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.s'),true);
update public.qc_learning_proposals set status='withdrawn' where id=current_setting('test.l')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.o'),true);
do $$begin if exists(select 1 from public.qc_library_feed() where id=current_setting('test.l')::uuid) then raise exception 'FAIL withdrawn excerpt visible';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('test.s'),true);
-- The private upload gate is project-scoped. All checks use synthetic fixtures.
do $$
declare
 p uuid := current_setting('test.p')::uuid;
 file text := p::text || '/' || gen_random_uuid()::text || '--gate.pdf';
 before_revision integer;
 second_project uuid := gen_random_uuid();
 confirmed jsonb;
 repeated jsonb;
begin
 select revision into before_revision from public.qc_projects where id=p;
 begin
  update public.qc_projects set orientation_route='prototype' where id=p;
  raise exception 'FAIL client may set orientation columns';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name,owner_id) values('qc-campus-documents',file,auth.uid()::text);
  raise exception 'FAIL student upload before orientation';
 exception when insufficient_privilege then null; end;
 begin
  perform public.qc_confirm_orientation(p,'prototype',E'\t  ',before_revision);
  raise exception 'FAIL whitespace-only task';
 exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.t'),true);
 begin
  perform public.qc_confirm_orientation(p,'prototype','Plan',before_revision);
  raise exception 'FAIL teacher may confirm for student';
 exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name,owner_id) values('qc-campus-documents',file,auth.uid()::text);
 perform set_config('request.jwt.claim.sub',current_setting('test.o'),true);
 begin
  perform public.qc_confirm_orientation(p,'prototype','Plan',before_revision);
  raise exception 'FAIL outsider confirmation';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.s'),true);
 if not exists (select from storage.objects where bucket_id='qc-campus-documents' and name=file) then
   raise exception 'FAIL existing document hidden during orientation';
 end if;
 confirmed:=public.qc_confirm_orientation(p,'prototype','Plan',before_revision);
 repeated:=public.qc_confirm_orientation(p,'prototype','Plan',before_revision);
 if jsonb_typeof(confirmed)<>'object' or (confirmed->>'orientation_task_id')::uuid is null or (repeated->>'orientation_task_id')::uuid<>(confirmed->>'orientation_task_id')::uuid
    or (repeated->>'revision')::integer<>before_revision+1 or (select count(*) from public.qc_tasks where project_id=p and title='Plan')<>1 then
  raise exception 'FAIL atomic or duplicate initial task';
 end if;
 insert into public.qc_projects(id,owner_id,kind,title)
 values(second_project,auth.uid(),'TFM','Synthetic second orientation');
 begin
  insert into storage.objects(bucket_id,name,owner_id) values(
   'qc-campus-documents',second_project::text||'/'||gen_random_uuid()::text||'--unconfirmed.pdf',auth.uid()::text);
  raise exception 'FAIL one project unlocks a different project';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.qc_projects(id,owner_id,kind,title,orientation_route,orientation_task_id,orientation_first_step)
  values(gen_random_uuid(),auth.uid(),'TFG','Synthetic forged gate','prototype',gen_random_uuid(),'Forged');
  raise exception 'FAIL forged orientation on project creation';
 exception when insufficient_privilege then null; end;
 begin
  perform public.qc_confirm_orientation(p,'literature','Other plan',before_revision);
  raise exception 'FAIL stale orientation overwrite';
 exception when serialization_failure then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.t'),true);
 repeated:=public.qc_confirm_orientation(p,'research_plan','Prepare the protocol',(confirmed->>'revision')::integer);
 if (repeated->>'orientation_task_id')::uuid<>(confirmed->>'orientation_task_id')::uuid or
    (select title from public.qc_tasks where id=(repeated->>'orientation_task_id')::uuid)<>'Prepare the protocol' then
  raise exception 'FAIL assigned teacher revision';
 end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.s'),true);
end $$;
insert into storage.objects(bucket_id,name,owner_id,metadata) values('qc-campus-documents',current_setting('test.p')||'/'||current_setting('test.task')||'--proof.pdf',auth.uid()::text,'{"mimetype":"application/pdf","size":100}');
select set_config('request.jwt.claim.sub',current_setting('test.o'),true);
do $$begin if exists(select 1 from storage.objects where bucket_id='qc-campus-documents') then raise exception 'FAIL outsider document read';end if;
 begin insert into storage.objects(bucket_id,name,owner_id) values('qc-campus-documents',current_setting('test.p')||'/'||current_setting('test.l')||'--forged.pdf',auth.uid()::text);raise exception 'FAIL outsider document write';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.t'),true);
do $$begin if not exists(select 1 from storage.objects where bucket_id='qc-campus-documents' and name like current_setting('test.p')||'/%') then raise exception 'FAIL teacher document read';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('test.s'),true);
do $$begin update storage.objects set metadata='{}' where bucket_id='qc-campus-documents';if found then raise exception 'FAIL overwrite immutable document';end if;end $$;
reset role;
update qc_private.pilot_invites set revoked_at=now() where accepted_by=current_setting('test.s')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.s'),true);
do $$begin if public.qc_accept_pilot() is not null or exists(select 1 from public.qc_projects where id=current_setting('test.p')::uuid) then raise exception 'FAIL revoked access';end if;end $$;
reset role;
select 'PASS: invitation, TR persistence, teacher assignment, private isolation, concurrency, review, consent, withdrawal, private documents and revocation' as result;
rollback;
