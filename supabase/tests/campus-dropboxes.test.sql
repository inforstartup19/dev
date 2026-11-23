-- Isolated fixture with invented users. Run after the complete Campus schema.
begin;
create function pg_temp.u(k text) returns uuid language sql stable as $$
 select current_setting('qa.drop.' || k)::uuid
$$;
create function pg_temp.actor(k text) returns text language sql as $$
 select set_config('request.jwt.claim.sub',pg_temp.u(k)::text,true)
$$;
create function pg_temp.check_result(ok boolean,why text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Dropbox regression: %',why; end if;end $$;
select set_config('qa.drop.'||k,gen_random_uuid()::text,true) from unnest(array[
'teacher','student','classmate','outsider','manager','teacher2','open','many','future','late','failed','existing',
'teacher_p','student_p','classmate_p','outsider_p','manager_p','teacher2_p']) k;
select set_config('qa.drop.school',qc_private.operator_create_university('qa-drop-school','Synthetic school')::text,true);
insert into auth.users(id,email,email_confirmed_at)
select pg_temp.u(k),pg_temp.u(k)::text||'@example.test',now()
from unnest(array['teacher','student','classmate','outsider','manager','teacher2']) k;
insert into qc_private.pilot_invites(person_id,email,role,institution_id)
select pg_temp.u(k||'_p'),pg_temp.u(k)::text||'@example.test',r,pg_temp.u('school')
from (values('teacher','teacher'),('student','student'),('classmate','student'),('outsider','student'),('manager','manager'),('teacher2','teacher')) x(k,r);
select qc_private.operator_set_manager(pg_temp.u('school'), pg_temp.u('manager')::text||'@example.test', true);
set local role authenticated;
do $$ declare k text;begin foreach k in array array['teacher','student','classmate','outsider','teacher2','manager'] loop
 perform pg_temp.actor(k);perform public.qc_accept_pilot();
end loop;end $$;
select public.qc_university_set_assignment(pg_temp.u('teacher_p'),pg_temp.u('student_p'),'supervise',0);
select public.qc_university_set_assignment(pg_temp.u('teacher_p'),pg_temp.u('classmate_p'),'evaluate',1);
select pg_temp.actor('student');
insert into public.qc_projects(id,owner_id,kind,title) values(pg_temp.u('existing'),auth.uid(),'TFG','Existing separate paper');
select pg_temp.actor('teacher');
create function pg_temp.drop_create(k text, to_students uuid[], begins timestamptz, ends_at timestamptz, multiple boolean)
returns uuid language sql as $$
 select public.qc_drop_create(pg_temp.u(k),'Dossier final','Enginyeria','TFG','Lliura un fitxer.',begins,ends_at,multiple,to_students)
$$;
create function pg_temp.slot(k text, subject text) returns jsonb language sql stable as $$
 select r from jsonb_array_elements(public.qc_drop_list()->'spaces') sp
 cross join lateral jsonb_array_elements(sp->'recipients') r
 where sp->>'id'=pg_temp.u(k)::text and r->>'id'=pg_temp.u(subject||'_p')::text
$$;
create function pg_temp.upload(n text) returns void language sql as $$
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('qc-campus-documents',n,auth.uid()::text,'{"size":128,"mimetype":"application/pdf"}'::jsonb)
$$;
do $$ declare deadline timestamptz:=now()+interval '1 day'; created uuid;begin
 created:=pg_temp.drop_create('open',array[pg_temp.u('student_p'),pg_temp.u('classmate_p')],null,deadline,false);
 perform pg_temp.check_result(created=pg_temp.u('open'),'created identifier');
 perform pg_temp.check_result(created=pg_temp.drop_create('open',array[pg_temp.u('student_p'),pg_temp.u('classmate_p')],null,deadline,false),'create retry');
 perform pg_temp.check_result(pg_temp.slot('open','classmate') is not null,'teacher receives own class slots');
 begin
  perform pg_temp.drop_create('failed',array[pg_temp.u('outsider_p')],null,deadline,false);
  raise exception 'Unassigned recipient accepted';
 exception when insufficient_privilege then null; end;
end $$;
select pg_temp.drop_create('many',array[pg_temp.u('student_p')],null,now()+interval '1 day',true);
select pg_temp.drop_create('late',array[pg_temp.u('student_p')],now()-interval '3 days',now()+interval '1 day',false);
select pg_temp.drop_create('future',array[pg_temp.u('student_p')],now()+interval '1 day',now()+interval '2 days',false);
select pg_temp.actor('teacher2');
select pg_temp.check_result(pg_temp.slot('open','student') is null,'unrelated tutor cannot see slot');
select pg_temp.actor('student');
select pg_temp.check_result(pg_temp.slot('open','classmate') is null,'student cannot see classmates');
select pg_temp.check_result(pg_temp.slot('open','student') is not null,'student sees own slot before uploading');
select pg_temp.check_result((select count(*)=1 from public.qc_projects where owner_id=auth.uid()),'no placeholder student work');
select set_config('qa.drop.path', (pg_temp.slot('open','student')->>'project_id')||'/'||gen_random_uuid()||'--TFG.pdf',true);
select set_config('qa.drop.multi_path', (pg_temp.slot('many','student')->>'project_id')||'/'||gen_random_uuid()||'--Annex.pdf',true);
select set_config('qa.drop.future_path', (pg_temp.slot('future','student')->>'project_id')||'/'||gen_random_uuid()||'--TFG.pdf',true);
do $$begin
 begin perform pg_temp.upload(current_setting('qa.drop.future_path')); raise exception 'Early upload accepted';
 exception when insufficient_privilege then null;end;
 begin perform public.qc_drop_confirm(pg_temp.u('open'),current_setting('qa.drop.path'));raise exception 'Missing upload accepted';
 exception when invalid_parameter_value then null;end;
end $$;
select pg_temp.actor('classmate');
do $$begin
 begin perform pg_temp.upload(current_setting('qa.drop.path'));raise exception 'Other student wrote slot';
 exception when insufficient_privilege then null;end;
end $$;
select pg_temp.actor('student');
select pg_temp.upload(current_setting('qa.drop.path'));
select pg_temp.check_result(exists(select from storage.objects where name=current_setting('qa.drop.path') and owner_id=auth.uid()::text),'student can recover their own pending object');
select pg_temp.check_result(jsonb_array_length(pg_temp.slot('open','student')->'pending')=1,'lost confirmation recoverable through list');
select pg_temp.check_result((select count(*)=1 from public.qc_projects where owner_id=auth.uid()),'raw object alone never submits project');
-- Both tabs can have finished transferring before either obtains the single receipt.
select set_config('qa.drop.concurrent_path',split_part(current_setting('qa.drop.path'),'/',1)||'/'||gen_random_uuid()||'--Rival.pdf',true);
select pg_temp.upload(current_setting('qa.drop.concurrent_path'));
select pg_temp.actor('teacher');
select pg_temp.check_result(not exists(select from storage.objects where name=current_setting('qa.drop.path')),'pending uploads stay private');
select pg_temp.actor('classmate');
do $$begin
 begin perform public.qc_drop_confirm(pg_temp.u('open'),current_setting('qa.drop.path'));raise exception 'Classmate confirmed another student file';
 exception when invalid_parameter_value or no_data_found or insufficient_privilege then null;end;
end $$;
select pg_temp.actor('student');
do $$declare receipt jsonb;begin
 receipt:=public.qc_drop_confirm(pg_temp.u('open'),current_setting('qa.drop.path'));
 perform pg_temp.check_result(receipt->>'storage_name'=current_setting('qa.drop.path') and receipt->>'submitted_at' is not null,'receipt linked to stored object');
 perform pg_temp.check_result(receipt=public.qc_drop_confirm(pg_temp.u('open'),current_setting('qa.drop.path')),'idempotent receipt after lost response');
 perform pg_temp.check_result(jsonb_array_length(pg_temp.slot('open','student')->'files')=1 and jsonb_array_length(pg_temp.slot('open','student')->'pending')=0,'one confirmed and zero pending');
 perform pg_temp.check_result(exists(select from public.qc_projects where id=(receipt->>'project_id')::uuid and owner_id=auth.uid() and kind='TFG'),'student owns only the actual submitted work');
end $$;
do $$begin
 begin perform public.qc_drop_confirm(pg_temp.u('open'),current_setting('qa.drop.concurrent_path'));raise exception 'Racing upload obtained second receipt';
 exception when unique_violation then null;end;
end $$;
select pg_temp.check_result(exists(select from public.qc_projects where id=pg_temp.u('existing') and title='Existing separate paper'),'old project preserved');
select pg_temp.actor('teacher');
select pg_temp.check_result(jsonb_array_length(pg_temp.slot('open','student')->'files')=1 and jsonb_array_length(pg_temp.slot('open','classmate')->'files')=0,'correct recipient and status for teacher');
select pg_temp.check_result(exists(select from storage.objects where bucket_id='qc-campus-documents' and name=current_setting('qa.drop.path')),'assigned teacher can download evidence');
select pg_temp.check_result(not exists(select from storage.objects where name=current_setting('qa.drop.concurrent_path')),'unconfirmed concurrent upload remains private after a receipt');
select pg_temp.actor('student');
select pg_temp.upload(current_setting('qa.drop.multi_path'));
select public.qc_drop_confirm(pg_temp.u('many'),current_setting('qa.drop.multi_path'));
select set_config('qa.drop.multi_again', split_part(current_setting('qa.drop.multi_path'),'/',1)||'/'||gen_random_uuid()||'--Annex.pdf',true);
select pg_temp.upload(current_setting('qa.drop.multi_again'));
select public.qc_drop_confirm(pg_temp.u('many'),current_setting('qa.drop.multi_again'));
select pg_temp.check_result(jsonb_array_length(pg_temp.slot('many','student')->'files')=2,'additional documents have distinct receipts');
-- Simulate an object accepted during the window, then a disconnected browser recovering after closure.
select set_config('qa.drop.late_path',(pg_temp.slot('late','student')->>'project_id')||'/'||gen_random_uuid()||'--TFG.pdf',true);
select pg_temp.upload(current_setting('qa.drop.late_path'));
reset role;
update storage.objects set created_at=now()-interval '2 days' where name=current_setting('qa.drop.late_path');
update qc_private.drop_spaces set due_at=now()-interval '1 day' where id=pg_temp.u('late');
set local role authenticated;
select pg_temp.actor('student');
select pg_temp.check_result(public.qc_drop_confirm(pg_temp.u('late'),current_setting('qa.drop.late_path'))->>'storage_name'=current_setting('qa.drop.late_path'),'recover on-time upload after deadline');
do $$begin
 begin perform pg_temp.upload(split_part(current_setting('qa.drop.late_path'),'/',1)||'/'||gen_random_uuid()||'--Late.pdf');raise exception 'New upload accepted after deadline';
 exception when insufficient_privilege then null;end;
 begin perform pg_temp.upload(split_part(current_setting('qa.drop.path'),'/',1)||'/'||gen_random_uuid()||'--Second.pdf');raise exception 'Second upload accepted in single file mode';
 exception when insufficient_privilege then null;end;
end $$;
select pg_temp.actor('manager');
select public.qc_university_set_assignment(pg_temp.u('teacher_p'),pg_temp.u('student_p'),'none',2);
select pg_temp.actor('teacher');
select pg_temp.check_result(pg_temp.slot('open','student') is null and pg_temp.slot('open','classmate') is not null,'revocation scoped per student');
select pg_temp.check_result(not exists(select from storage.objects where name=current_setting('qa.drop.path')),'revoked reviewer cannot read document');
set local role anon;
do $$begin
 begin perform public.qc_drop_list();raise exception 'Anonymous read';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.check_result(not exists(select from public.qc_document_reviews where project_id=split_part(current_setting('qa.drop.path'),'/',1)::uuid)
 and not exists(select from public.qc_learning_proposals where project_id=split_part(current_setting('qa.drop.path'),'/',1)::uuid),'upload never requests a model or proposes publication');
rollback;
