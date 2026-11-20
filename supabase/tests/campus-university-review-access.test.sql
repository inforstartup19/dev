-- Disposable database only. All IDs, enrollments, documents and results are synthetic.
-- The service calls below only exercise the database protocol. No provider is called.
begin;
create function pg_temp.id(k text) returns uuid language sql stable as $$
  select current_setting('qa.review.' || k)::uuid
$$;
create function pg_temp.act(k text) returns text language sql as $$
  select set_config('request.jwt.claim.sub',pg_temp.id(k)::text,true)
$$;
create function pg_temp.check_result(ok boolean,reason text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Failed regression: %',reason; end if;
end $$;

select set_config('qa.review.'||key,gen_random_uuid()::text,true)
from unnest(array['student','teacher','manager','work','task','proposal','file','claim',
                  'student_person','teacher_person','manager_person']) key;
insert into auth.users(id,email,email_confirmed_at)
select pg_temp.id(k),pg_temp.id(k)::text||'@example.test',now()
from unnest(array['student','teacher','manager']) k;
insert into qc_private.pilot_invites(person_id,email,role,institution_id)
select pg_temp.id(k||'_person'),pg_temp.id(k)::text||'@example.test',k,
       (select id from qc_private.universities where code='quelcom-pilot')
from unnest(array['student','teacher','manager']) k;
select qc_private.operator_set_manager((select id from qc_private.universities where code='quelcom-pilot'),
                                        pg_temp.id('manager')::text||'@example.test',true);
set local role authenticated;
do $$
declare actor text; begin
  foreach actor in array array['teacher','manager','student'] loop
    perform pg_temp.act(actor);
    perform pg_temp.check_result(public.qc_accept_pilot() is not null,'enrollment');
  end loop;
end $$;
insert into public.qc_projects(id,owner_id,kind,title) values(pg_temp.id('work'),auth.uid(),'TFG','Synthetic TFG');
select public.qc_confirm_orientation(pg_temp.id('work'),'empirical','Collect synthetic evidence',0);
insert into storage.objects(bucket_id,name,owner_id,metadata)
values('qc-campus-documents',pg_temp.id('work')::text||'/'||pg_temp.id('file')::text||'--model.pdf',
       auth.uid()::text,'{"size":24,"mimetype":"application/pdf"}');
insert into public.qc_tasks(id,project_id,title,deliverable,criteria)
values(pg_temp.id('task'),pg_temp.id('work'),'Synthetic experiment','A table','Results explained');
update public.qc_tasks set status='active' where id=pg_temp.id('task');
update public.qc_tasks set status='review' where id=pg_temp.id('task');
insert into public.qc_learning_proposals(id,project_id,owner_id,kind,title,summary,learning,consent)
values(pg_temp.id('proposal'),pg_temp.id('work'),auth.uid(),'TFG','Synthetic finding','Summary','Evidence',true);
select public.qc_defense_save(pg_temp.id('work'),0,'submit','A short talk','A question',null,15,10,null);

create function pg_temp.change_mode(new_mode text) returns void language plpgsql as $$
declare revision integer;
begin
  perform pg_temp.act('manager');
  revision:=(public.qc_university_roster()->>'revision')::integer;
  perform public.qc_university_set_assignment(pg_temp.id('teacher_person'),pg_temp.id('student_person'),new_mode,revision);
  perform pg_temp.act('teacher');
end $$;
select pg_temp.change_mode('supervise');
do $$
declare work uuid := pg_temp.id('work'); begin
  perform pg_temp.check_result(exists(select 1 from public.qc_projects where id=work),'tutor can open assigned project');
  perform pg_temp.check_result(public.qc_can_evaluate(work)=false,'supervisor has no evaluation permission');
  perform pg_temp.check_result(public.qc_defense_get(work)->>'status'='submitted','tutor may read the sent rehearsal');
  insert into public.qc_tasks(project_id,title) values(work,'Tutoring appointment');
  begin
    update public.qc_tasks set status='done',review_comment='Approved' where id=pg_temp.id('task');
    raise exception 'Supervision-only tutor approved a task';
  exception when insufficient_privilege then null; end;
  begin
    update public.qc_tasks set review_comment='A verdict' where id=pg_temp.id('task');
    raise exception 'Supervision-only tutor changed a verdict comment';
  exception when insufficient_privilege then null; end;
  begin
    perform public.qc_defense_save(work,1,'validate',null,null,null,null,null,'Valid');
    raise exception 'Supervision-only tutor validated a rehearsal';
  exception when insufficient_privilege then null; end;
  begin
    update public.qc_learning_proposals set status='published',review_comment='Ready' where id=pg_temp.id('proposal');
    raise exception 'Supervision-only tutor published an excerpt';
  exception when insufficient_privilege then null; end;
end $$;

set local role service_role;
select pg_temp.check_result(
  (public.qc_claim_document_review(pg_temp.id('claim'),pg_temp.id('work'),pg_temp.id('file')::text||'--model.pdf',
    pg_temp.id('teacher'),repeat('a',64),24,'Review','test-model')->>'claimed')::boolean,
  'supervision authorizes a private advisory document review'
);
set local role authenticated;
select pg_temp.change_mode('evaluate');
do $$
declare work uuid := pg_temp.id('work'); begin
  perform pg_temp.check_result(public.qc_can_evaluate(work),'evaluation enabled');
  update public.qc_tasks set status='done',review_comment='Evidence reviewed' where id=pg_temp.id('task');
  perform pg_temp.check_result(found,'evaluation recorded a task decision');
  perform pg_temp.check_result(public.qc_defense_save(work,1,'validate',null,null,null,null,null,'Ready')->>'status'='rehearsed',
                               'evaluation recorded a rehearsal decision');
  update public.qc_learning_proposals set status='published',review_comment='Permission verified' where id=pg_temp.id('proposal');
  perform pg_temp.check_result(found,'evaluation published a consented excerpt');
end $$;
select pg_temp.change_mode('supervise');
do $$ begin
  begin
    -- The prior review comment is unchanged: transition authorization must still run.
    update public.qc_tasks set status='revise' where id=pg_temp.id('task');
    raise exception 'Demoted evaluator reopened a completed task';
  exception when insufficient_privilege then null; end;
  perform pg_temp.check_result((select status from public.qc_tasks where id=pg_temp.id('task'))='done','retained reviewed state');
end $$;
select pg_temp.change_mode('none');
do $$
declare work uuid := pg_temp.id('work'); begin
  perform pg_temp.check_result(not exists(select 1 from public.qc_projects where id=work),'project access revoked');
  perform pg_temp.check_result(not exists(select 1 from public.qc_tasks where project_id=work),'task access revoked');
  perform pg_temp.check_result(not exists(select 1 from public.qc_document_reviews where project_id=work),'AI review access revoked');
  perform pg_temp.check_result(not exists(select 1 from storage.objects where bucket_id='qc-campus-documents'
                                           and name=work::text||'/'||pg_temp.id('file')::text||'--model.pdf'),'attachment access revoked');
  begin
    perform public.qc_defense_get(work);
    raise exception 'Unassigned teacher read a rehearsal';
  exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
do $$
declare work uuid := pg_temp.id('work'); begin
  begin
    perform public.qc_finish_document_review(pg_temp.id('claim'),pg_temp.id('teacher'),'completed','{}',null);
    raise exception 'Unassigned teacher finalized a pending provider result';
  exception when insufficient_privilege then null; end;
  begin
    perform public.qc_claim_document_review(gen_random_uuid(),work,pg_temp.id('file')::text||'--model.pdf',
                                             pg_temp.id('teacher'),repeat('b',64),24,'Review','test-model');
    raise exception 'Unassigned teacher started a new advisory review';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
