-- Run after campus-document-ai.sql as the migration/test administrator.
-- Synthetic identities, metadata and AI outputs only; everything rolls back.
begin;
select set_config('test.ai_s',gen_random_uuid()::text,true),
 set_config('test.ai_t',gen_random_uuid()::text,true),
 set_config('test.ai_o',gen_random_uuid()::text,true),
 set_config('test.ai_p',gen_random_uuid()::text,true),
 set_config('test.ai_p2',gen_random_uuid()::text,true),
 set_config('test.ai_file',gen_random_uuid()::text||'--proof.pdf',true),
 set_config('test.ai_r',gen_random_uuid()::text,true),
 set_config('test.ai_lease',gen_random_uuid()::text,true),
 set_config('test.ai_next',gen_random_uuid()::text,true),
 set_config('test.ai_revoked',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
 select current_setting('test.ai_'||k)::uuid,current_setting('test.ai_'||k)||'@example.test',now()
 from unnest(array['s','t','o']) k;
insert into qc_private.pilot_invites(email,role) values
 (current_setting('test.ai_s')||'@example.test','student'),
 (current_setting('test.ai_t')||'@example.test','teacher'),
 (current_setting('test.ai_o')||'@example.test','student');
-- Operator fixture: this teacher evaluates only the selected student.
insert into qc_private.university_assignments(institution_id,teacher_id,student_id,mode)
select t.institution_id,t.person_id,s.person_id,'evaluate'
from qc_private.pilot_invites t join qc_private.pilot_invites s using(institution_id)
where t.email=current_setting('test.ai_t')||'@example.test'
  and s.email=current_setting('test.ai_s')||'@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.ai_s'),true);
select public.qc_accept_pilot();
insert into public.qc_projects(id,owner_id,kind,title)
 values(current_setting('test.ai_p')::uuid,auth.uid(),'TFG','Synthetic document AI test');
select public.qc_confirm_orientation(current_setting('test.ai_p')::uuid,'empirical','Document the first analysis',0);
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('qc-campus-documents',current_setting('test.ai_p')||'/'||current_setting('test.ai_file'),auth.uid()::text,'{"mimetype":"application/pdf","size":100}');
-- The Storage metadata permission contract admits all seven formats.
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'qc-campus-documents',current_setting('test.ai_p')||'/'||gen_random_uuid()::text||'--proof.'||ext,
 auth.uid()::text,jsonb_build_object('mimetype',mime,'size',100)
 from (values
  ('doc','application/msword'),
  ('docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  ('xls','application/vnd.ms-excel'),
  ('xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  ('ppt','application/vnd.ms-powerpoint'),
  ('pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation')
 ) formats(ext,mime);
do $$begin
 if (select count(*) from storage.objects where bucket_id='qc-campus-documents' and name like current_setting('test.ai_p')||'/%')<>7
 then raise exception 'FAIL Office document paths';end if;
 if qc_private.document_project(current_setting('test.ai_p')||'/'||gen_random_uuid()::text||'--macro.docm') is not null
  or qc_private.document_project(current_setting('test.ai_p')||'/../proof.pdf') is not null
 then raise exception 'FAIL unsupported or traversal path';end if;
 if has_function_privilege('authenticated','public.qc_claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text)','EXECUTE')
  or has_function_privilege('authenticated','public.qc_finish_document_review(uuid,uuid,text,jsonb,text)','EXECUTE')
  or has_function_privilege('anon','public.qc_claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text)','EXECUTE')
  or has_function_privilege('authenticated','qc_private.claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text)','EXECUTE')
 then raise exception 'FAIL client privileged RPC';end if;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),auth.uid(),repeat('a',64),100,'Review','test-model');
  raise exception 'FAIL client RPC execution';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.ai_o'),true);
select public.qc_accept_pilot();
insert into public.qc_projects(id,owner_id,kind,title)
 values(current_setting('test.ai_p2')::uuid,auth.uid(),'TFM','Synthetic second project');
select public.qc_confirm_orientation(current_setting('test.ai_p2')::uuid,'empirical','Document the first analysis',0);
insert into storage.objects(bucket_id,name,owner_id,metadata) values
 ('qc-campus-documents',current_setting('test.ai_p2')||'/'||current_setting('test.ai_file'),auth.uid()::text,'{"mimetype":"application/pdf","size":100}');
select set_config('request.jwt.claim.sub',current_setting('test.ai_t'),true);
select public.qc_accept_pilot();
reset role;

set local role service_role;
do $$declare response jsonb;begin
 response:=public.qc_claim_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'  Review  ','test-model');
 if response->>'claimed'<>'true' or response->'review'->>'status'<>'processing' or response->'review'->>'question'<>'Review'
 then raise exception 'FAIL initial claim';end if;
 response:=public.qc_claim_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'Review','test-model');
 if response->>'claimed'<>'false' then raise exception 'FAIL duplicate starts provider again';end if;
 begin
  perform public.qc_claim_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('b',64),100,'Review','test-model');
  raise exception 'FAIL mutable request metadata';
 exception when unique_violation then null;end;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_o')::uuid,repeat('a',64),100,'Review','test-model');
  raise exception 'FAIL outsider claim';
 exception when insufficient_privilege then null;end;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p')::uuid,gen_random_uuid()::text||'--missing.pdf',current_setting('test.ai_s')::uuid,repeat('a',64),100,'Review','test-model');
  raise exception 'FAIL nonexistent document';
 exception when insufficient_privilege then null;end;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),99,'Review','test-model');
  raise exception 'FAIL mismatched document size';
 exception when insufficient_privilege then null;end;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_t')::uuid,repeat('a',64),100,'Review','test-model');
  raise exception 'FAIL concurrent project review';
 exception when raise_exception then if SQLERRM<>'Review already processing' then raise;end if;end;
 begin
  perform public.qc_finish_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_t')::uuid,'completed','{}',null);
  raise exception 'FAIL teacher takes over requester';
 exception when insufficient_privilege then null;end;
 begin
  perform public.qc_finish_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_s')::uuid,'completed','[]',null);
  raise exception 'FAIL invalid result shape';
 exception when invalid_parameter_value then null;end;
 response:=public.qc_finish_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_s')::uuid,'completed','{"summary":"Synthetic review","citations":[]}',null);
 if response->>'status'<>'completed' then raise exception 'FAIL completion';end if;
 begin
  perform public.qc_finish_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_s')::uuid,'failed',null,'provider_error');
  raise exception 'FAIL completed result overwritten';
 exception when raise_exception then if SQLERRM<>'Review is no longer processing' then raise;end if;end;
 response:=public.qc_claim_document_review(current_setting('test.ai_r')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'Review','test-model');
 if response->>'claimed'<>'false' or response->'review'->>'status'<>'completed'
 then raise exception 'FAIL completed retry';end if;
 begin update public.qc_document_reviews set model='forged';raise exception 'FAIL service direct DML';
 exception when insufficient_privilege then null;end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.ai_s'),true);
do $$begin
 if not exists(select 1 from public.qc_document_reviews where id=current_setting('test.ai_r')::uuid and status='completed')
 then raise exception 'FAIL owner result read';end if;
 begin update public.qc_document_reviews set status='failed';raise exception 'FAIL client update';
 exception when insufficient_privilege then null;end;
 begin delete from public.qc_document_reviews;raise exception 'FAIL client delete';
 exception when insufficient_privilege then null;end;
 begin insert into public.qc_document_reviews(id) values(gen_random_uuid());raise exception 'FAIL client insert';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.ai_t'),true);
do $$begin
 if not exists(select 1 from public.qc_document_reviews where id=current_setting('test.ai_r')::uuid)
 then raise exception 'FAIL assigned teacher result read';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.ai_o'),true);
do $$begin
 if exists(select 1 from public.qc_document_reviews where project_id=current_setting('test.ai_p')::uuid)
 then raise exception 'FAIL outsider result leak';end if;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform 1 from public.qc_document_reviews;raise exception 'FAIL anonymous result read';
 exception when insufficient_privilege then null;end;
end $$;
reset role;

-- Expired work cannot finish and does not indefinitely block the project.
set local role service_role;
select public.qc_claim_document_review(current_setting('test.ai_lease')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'','test-model');
reset role;
update public.qc_document_reviews set created_at=clock_timestamp()-interval '121 seconds' where id=current_setting('test.ai_lease')::uuid;
set local role service_role;
do $$declare response jsonb;begin
 begin
  perform public.qc_finish_document_review(current_setting('test.ai_lease')::uuid,current_setting('test.ai_s')::uuid,'completed','{}',null);
  raise exception 'FAIL expired worker completion';
 exception when raise_exception then if SQLERRM<>'Review lease expired' then raise;end if;end;
 response:=public.qc_claim_document_review(current_setting('test.ai_next')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'Review','test-model');
 if response->>'claimed'<>'true' then raise exception 'FAIL lease recovery';end if;
 response:=public.qc_claim_document_review(current_setting('test.ai_lease')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'','test-model');
 if response->>'claimed'<>'false' or response->'review'->>'error_code'<>'lease_expired'
 then raise exception 'FAIL immutable expired attempt';end if;
 perform public.qc_finish_document_review(current_setting('test.ai_next')::uuid,current_setting('test.ai_s')::uuid,'failed',null,'provider_unavailable');
end $$;
-- Exactly ten accepted requests/hour across all projects for the actor.
do $$declare review_id uuid;begin
 for n in 1..10 loop
  review_id:=gen_random_uuid();
  perform public.qc_claim_document_review(review_id,current_setting('test.ai_p2')::uuid,current_setting('test.ai_file'),current_setting('test.ai_o')::uuid,repeat('a',64),100,'Review','test-model');
  perform public.qc_finish_document_review(review_id,current_setting('test.ai_o')::uuid,'failed',null,'synthetic_error');
 end loop;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p2')::uuid,current_setting('test.ai_file'),current_setting('test.ai_o')::uuid,repeat('a',64),100,'Review','test-model');
  raise exception 'FAIL eleventh review admitted';
 exception when raise_exception then if SQLERRM<>'Review rate limit exceeded' then raise;end if;end;
end $$;
select public.qc_claim_document_review(current_setting('test.ai_revoked')::uuid,current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'Review','test-model');
reset role;
update qc_private.pilot_invites set revoked_at=now() where accepted_by=current_setting('test.ai_s')::uuid;
set local role service_role;
do $$begin
 begin
  perform public.qc_finish_document_review(current_setting('test.ai_revoked')::uuid,current_setting('test.ai_s')::uuid,'completed','{}',null);
  raise exception 'FAIL revoked requester completion';
 exception when insufficient_privilege then null;end;
 begin
  perform public.qc_claim_document_review(gen_random_uuid(),current_setting('test.ai_p')::uuid,current_setting('test.ai_file'),current_setting('test.ai_s')::uuid,repeat('a',64),100,'Review','test-model');
  raise exception 'FAIL revoked requester claim';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.ai_s'),true);
do $$begin
 if exists(select 1 from public.qc_document_reviews where project_id=current_setting('test.ai_p')::uuid)
 then raise exception 'FAIL revoked result read';end if;
end $$;
reset role;
select 'PASS: Office paths, private review RLS, service-only RPCs, immutable retries, exact objects, quota, lease, completion and revocation' as result;
rollback;
