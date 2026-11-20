-- Run only against a disposable database with the documented pilot schema.
-- All identities, attachments, members and text below are fabricated.
begin;
select set_config('test.defense.'||k, gen_random_uuid()::text, true)
from unnest(array['student','teacher','outsider','colleague','work','otherwork','file','elsefile']) k;
insert into auth.users(id,email,email_confirmed_at)
select current_setting('test.defense.'||k)::uuid, current_setting('test.defense.'||k)||'@example.test', now()
from unnest(array['student','teacher','outsider','colleague']) k;
insert into qc_private.pilot_invites(email, role)
select current_setting('test.defense.'||k)||'@example.test',
       case when k in ('student','outsider') then 'student' else 'teacher' end
from unnest(array['student','teacher','outsider','colleague']) k;
set local role authenticated;
do $$
declare actor text;
begin
 foreach actor in array array['teacher','outsider','colleague','student'] loop
   perform set_config('request.jwt.claim.sub',current_setting('test.defense.'||actor),true);
   if public.qc_accept_pilot() is null then raise exception 'FAIL synthetic enrollment'; end if;
 end loop;
end $$;
insert into public.qc_projects(id,owner_id,kind,title) values
(current_setting('test.defense.work')::uuid, auth.uid(), 'TR', 'Assaig sintètic');
select set_config('request.jwt.claim.sub',current_setting('test.defense.outsider'),true);
insert into public.qc_projects(id,owner_id,kind,title) values
(current_setting('test.defense.otherwork')::uuid, auth.uid(), 'TFM', 'Altre assaig sintètic');

reset role;
-- An extra student can be a project member in the underlying schema. They
-- must not see the owner's defense draft. The second teacher is unassigned.
insert into public.qc_members(project_id,user_id,role) values
(current_setting('test.defense.work')::uuid,current_setting('test.defense.teacher')::uuid,'teacher'),
(current_setting('test.defense.work')::uuid,current_setting('test.defense.outsider')::uuid,'student');
insert into storage.objects(bucket_id,name,owner_id) values
('qc-campus-documents',current_setting('test.defense.work')||'/'||current_setting('test.defense.file')||'--slides.pdf',current_setting('test.defense.student')),
('qc-campus-documents',current_setting('test.defense.work')||'/'||current_setting('test.defense.file')||'--notes.docx',current_setting('test.defense.student')),
('qc-campus-documents',current_setting('test.defense.otherwork')||'/'||current_setting('test.defense.elsefile')||'--alien.pdf',current_setting('test.defense.outsider'));

set local role authenticated;
do $$
declare
 w uuid := current_setting('test.defense.work')::uuid;
 file_name text := current_setting('test.defense.file')||'--slides.pdf';
 bad_file text; actor text; row_data jsonb; replay jsonb;
begin
 foreach actor in array array['outsider','colleague'] loop
   perform set_config('request.jwt.claim.sub',current_setting('test.defense.'||actor),true);
   begin perform public.qc_defense_get(w); raise exception 'FAIL uninvolved member read';
   exception when insufficient_privilege then null; end;
   begin perform public.qc_defense_save(w,0,'submit','text','','',15,10,''); raise exception 'FAIL uninvolved member wrote';
   exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.student'),true);
 if public.qc_defense_get(w) is not null then raise exception 'FAIL opening created a rehearsal'; end if;
 begin perform public.qc_defense_save(w,0,'validate','','',null,15,10,'forged verdict'); raise exception 'FAIL student approved';
 exception when insufficient_privilege then null; end;
 begin perform public.qc_defense_save(w,0,'submit',E' \t\n','',null,15,10,''); raise exception 'FAIL blank submission';
 exception when invalid_parameter_value then null; end;
 foreach bad_file in array array[current_setting('test.defense.file')||'--notes.docx',current_setting('test.defense.elsefile')||'--alien.pdf','../other/file.pdf','https://example.test/file.pdf'] loop
   begin perform public.qc_defense_save(w,0,'save','outline','',bad_file,15,10,''); raise exception 'FAIL wrong attachment';
   exception when invalid_parameter_value then null; end;
 end loop;
 begin perform public.qc_defense_save(w,0,'save',repeat('x',6001),'',null,15,10,''); raise exception 'FAIL oversized outline';
 exception when invalid_parameter_value then null; end;
 begin perform public.qc_defense_save(w,0,'save','','',null,0,10,''); raise exception 'FAIL invalid time';
 exception when invalid_parameter_value then null; end;
 row_data := public.qc_defense_save(w,0,'save','','',null,15,0,'forged student feedback');
 if row_data->>'status' <> 'draft' or (row_data->>'revision')::int <> 1 or row_data->>'feedback' <> ''
    or row_data <> public.qc_defense_get(w) or row_data ? 'changed_by' then raise exception 'FAIL first draft'; end if;
 replay := public.qc_defense_save(w,0,'save','','',null,15,0,null);
 if replay <> row_data then raise exception 'FAIL idempotent save'; end if;
 begin perform public.qc_defense_save(w,0,'save','stale','',null,15,10,''); raise exception 'FAIL stale save';
 exception when serialization_failure then null; end;

 perform set_config('request.jwt.claim.sub',current_setting('test.defense.teacher'),true);
 if public.qc_defense_get(w) is not null then raise exception 'FAIL tutor read unsent first draft'; end if;
 begin perform public.qc_defense_save(w,1,'save','rewrite','',null,15,10,''); raise exception 'FAIL teacher rewrote draft';
 exception when insufficient_privilege then null; end;
 begin perform public.qc_defense_save(w,1,'validate',null,null,null,null,null,'too early'); raise exception 'FAIL teacher approved draft';
 exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.student'),true);
 row_data := public.qc_defense_save(w,1,'submit','Original outline','First question',file_name,18,12,null);
 if row_data->>'status' <> 'submitted' or row_data->>'attachment' <> file_name then raise exception 'FAIL submission'; end if;
 begin perform public.qc_defense_save(w,2,'save','edited','','',15,10,''); raise exception 'FAIL changed handed-in content';
 exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.teacher'),true);
 if public.qc_defense_get(w) <> row_data then raise exception 'FAIL teacher read'; end if;
 begin perform public.qc_defense_save(w,2,'return',null,null,null,null,null,' '); raise exception 'FAIL empty review';
 exception when invalid_parameter_value then null; end;
 row_data := public.qc_defense_save(w,2,'return','tampering','tampering','../tampering',999,999,'Explain the limitations');
 if row_data->>'status' <> 'changes_requested' or row_data->>'outline' <> 'Original outline'
   or row_data->>'questions' <> 'First question' or row_data->>'attachment' <> file_name
   or row_data->>'talk_minutes' <> '18' or row_data->>'question_minutes' <> '12'
   or row_data->>'feedback' <> 'Explain the limitations' then raise exception 'FAIL feedback altered authorship'; end if;
 if public.qc_defense_save(w,2,'return',null,null,null,null,null,'Explain the limitations') <> row_data then raise exception 'FAIL duplicate feedback'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.student'),true);
 row_data := public.qc_defense_save(w,3,'submit','Revised outline','',file_name,18,12,'forged');
 if row_data->>'feedback' <> 'Explain the limitations' then raise exception 'FAIL student forged feedback'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.teacher'),true);
 row_data := public.qc_defense_save(w,4,'validate',null,null,null,null,null,'Ready for another rehearsal');
 if row_data->>'status' <> 'rehearsed' or row_data->>'revision' <> '5' then raise exception 'FAIL validation'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.student'),true);
 begin perform public.qc_defense_save(w,5,'submit','new','','',15,10,''); raise exception 'FAIL implicit reopening';
 exception when invalid_parameter_value then null; end;
 row_data := public.qc_defense_save(w,5,'save','Next draft','','',15,10,'');
 if row_data->>'revision' <> '6' or row_data->>'status' <> 'draft' then raise exception 'FAIL revised draft'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.defense.teacher'),true);
 row_data := public.qc_defense_get(w);
 if row_data->>'revision' is distinct from '5' or row_data->>'outline' is distinct from 'Revised outline'
    or row_data->>'status' is distinct from 'rehearsed' then raise exception 'FAIL tutor saw new unsent work'; end if;
 begin perform 1 from public.qc_defense_rehearsals where project_id=w;
   raise exception 'FAIL direct draft read'; exception when insufficient_privilege then null; end;
 begin update public.qc_defense_rehearsals set status = 'rehearsed' where project_id=w;
   raise exception 'FAIL direct write'; exception when insufficient_privilege then null; end;
 begin delete from qc_private.defense_rehearsal_events where project_id=w;
   raise exception 'FAIL erased history'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare w uuid := current_setting('test.defense.work')::uuid;
begin
 if (select count(*) from qc_private.defense_rehearsal_events where project_id=w) <> 4
    or (select snapshot->>'outline' from qc_private.defense_rehearsal_events where project_id=w and revision=2) <> 'Original outline'
    or (select snapshot->>'feedback' from qc_private.defense_rehearsal_events where project_id=w and revision=5) <> 'Ready for another rehearsal'
 then raise exception 'FAIL version history'; end if;
end $$;
update qc_private.pilot_invites set revoked_at=now() where accepted_by=current_setting('test.defense.teacher')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.defense.teacher'),true);
do $$begin
 begin perform public.qc_defense_get(current_setting('test.defense.work')::uuid); raise exception 'FAIL revoked tutor';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$begin
 begin perform public.qc_defense_get(current_setting('test.defense.work')::uuid); raise exception 'FAIL anonymous read';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
