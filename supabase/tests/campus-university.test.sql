-- Run with the complete pilot schema in an isolated test database only.
-- Synthetic two-centre roster. All writes roll back.
begin;
create function pg_temp.ident(k text) returns uuid language sql stable as $$
  select current_setting('qa.roster.'||k)::uuid
$$;
create function pg_temp.as_actor(k text) returns text language sql as $$
  select set_config('request.jwt.claim.sub',pg_temp.ident(k)::text,true)
$$;
create function pg_temp.must(ok boolean,reason text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Failed regression: %',reason; end if;
end $$;
select set_config('qa.roster.'||k,gen_random_uuid()::text,true)
from unnest(array['s1','s2','t1','m1','s_other','t_other','m_other','unknown','p1','p2',
                  's1_person','s2_person','t1_person','m1_person','s_other_person','t_other_person','m_other_person']) k;
select set_config('qa.roster.first',qc_private.operator_create_university('qa-centre-first','Synthetic A')::text,true);
select set_config('qa.roster.other',qc_private.operator_create_university('qa-centre-other','Synthetic B')::text,true);
insert into auth.users(id,email,email_confirmed_at)
select pg_temp.ident(k),pg_temp.ident(k)::text||'@example.test',now()
from unnest(array['s1','s2','t1','m1','s_other','t_other','m_other','unknown']) k;
insert into qc_private.pilot_invites(person_id,email,role,institution_id)
select pg_temp.ident(k||'_person'),pg_temp.ident(k)::text||'@example.test',r,pg_temp.ident(centre)
from (values('s1','student','first'),('s2','student','first'),('t1','teacher','first'),('m1','manager','first'),
            ('s_other','student','other'),('t_other','teacher','other'),('m_other','manager','other')) fixtures(k,r,centre);
select qc_private.operator_set_manager(pg_temp.ident('first'),pg_temp.ident('m1')::text||'@example.test',true);
select qc_private.operator_set_manager(pg_temp.ident('other'),pg_temp.ident('m_other')::text||'@example.test',true);
set local role authenticated;
do $$
declare k text; profile jsonb;
begin
  foreach k in array array['s1','t1','m1','s_other','t_other','m_other'] loop
    perform pg_temp.as_actor(k);
    profile:=public.qc_accept_pilot();
    perform pg_temp.must((profile->'institution'->>'id')::uuid=pg_temp.ident(case when k like '%other' then 'other' else 'first' end),
                         'accepted member sees their university');
    perform pg_temp.must((profile->'institution'->>'can_manage')::boolean=(k in ('m1','m_other')),'separate manager capability');
  end loop;
end $$;
do $$ declare k text; begin
  foreach k in array array['s1','t1','unknown'] loop
    perform pg_temp.as_actor(k);
    begin
      perform public.qc_university_roster();
      raise exception 'Non-manager read the roster';
    exception when insufficient_privilege then null; end;
    begin
      perform public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s1_person'),'evaluate',0);
      raise exception 'Non-manager changed an assignment';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform qc_private.operator_create_university('qa-no-client','Not created');
    raise exception 'Authenticated user created a centre';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.as_actor('s1');
insert into public.qc_projects(id,owner_id,kind,title,university)
  values(pg_temp.ident('p1'),auth.uid(),'TR','First paper','Synthetic B');
select pg_temp.as_actor('m1');
do $$
declare r jsonb:=public.qc_university_roster(); r1 jsonb; r2 jsonb; v integer:=(r->>'revision')::integer;
begin
  perform pg_temp.must(r->'institution'->>'name'='Synthetic A','roster centre');
  perform pg_temp.must(jsonb_array_length(r->'teachers')=1 and jsonb_array_length(r->'students')=2,'centre-only people');
  perform pg_temp.must(exists(select from jsonb_array_elements(r->'students') s where s->>'id'=pg_temp.ident('s2_person')::text and s->>'status'='invited'),
                            'pending invitation can be allocated before sign-in');
  perform pg_temp.must(not exists(select 1 from public.qc_projects where id=pg_temp.ident('p1')),'manager-only role does not read papers');
  begin
    perform public.qc_university_set_assignment(pg_temp.ident('t_other_person'),pg_temp.ident('s1_person'),'evaluate',v);
    raise exception 'Cross-centre teacher assigned';
  exception when insufficient_privilege then null; end;
  begin
    perform public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s_other_person'),'supervise',v);
    raise exception 'Cross-centre student assigned';
  exception when insufficient_privilege then null; end;
  r1:=public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s1_person'),'supervise',v);
  perform pg_temp.must((r1->>'revision')::integer>v,'assignment advances revision');
  r2:=public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s1_person'),'supervise',v);
  perform pg_temp.must(r1=r2,'unchanged duplicate response after lost request');
  begin
    perform public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s2_person'),'evaluate',v);
    raise exception 'Stale writer changed a different assignment';
  exception when serialization_failure then null; end;
  r2:=public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s2_person'),'evaluate',(r1->>'revision')::integer);
  perform pg_temp.must(exists(select 1 from jsonb_array_elements(r2->'assignments') a
                         where a->>'teacher_id'=pg_temp.ident('t1_person')::text and a->>'student_id'=pg_temp.ident('s2_person')::text and a->>'mode'='evaluate'),
                       'explicit evaluation scope');
end $$;
select pg_temp.as_actor('m_other');
do $$ declare r jsonb:=public.qc_university_roster(); begin
  perform pg_temp.must(jsonb_array_length(r->'teachers')=1 and jsonb_array_length(r->'students')=1
    and jsonb_array_length(r->'assignments')=0,'other centre remains isolated');
end $$;
select pg_temp.as_actor('s2');
select public.qc_accept_pilot();
insert into public.qc_projects(id,owner_id,kind,title) values(pg_temp.ident('p2'),auth.uid(),'TFM','Future paper');
select pg_temp.as_actor('s1');
do $$ declare a jsonb := public.qc_university_my_assignments(); begin
  perform pg_temp.must(jsonb_array_length(a)=1 and a->0->>'role'='teacher' and a->0->>'mode'='supervise',
                       'student sees only own supervisor');
end $$;
select pg_temp.as_actor('t1');
do $$ declare a jsonb:=public.qc_university_my_assignments(); begin
  perform pg_temp.must(jsonb_array_length(a)=2,'tutor sees both assigned students after acceptance');
  perform pg_temp.must(exists(select 1 from public.qc_projects where id=pg_temp.ident('p1'))
    and exists(select 1 from public.qc_projects where id=pg_temp.ident('p2')),'assignment applies to existing and future projects');
  perform pg_temp.must(not public.qc_can_evaluate(pg_temp.ident('p1')) and public.qc_can_evaluate(pg_temp.ident('p2')),
                       'two students of same tutor can receive different permissions');
end $$;
select pg_temp.as_actor('t_other');
select pg_temp.must(not exists(select 1 from public.qc_projects where id=pg_temp.ident('p1')),
                    'editable project university text cannot grant access');
select pg_temp.as_actor('m1');
do $$ declare v integer:=(public.qc_university_roster()->>'revision')::integer; begin
  perform public.qc_university_set_assignment(pg_temp.ident('t1_person'),pg_temp.ident('s1_person'),'none',v);
end $$;
select pg_temp.as_actor('t1');
select pg_temp.must(not exists(select 1 from public.qc_projects where id=pg_temp.ident('p1'))
  and public.qc_can_evaluate(pg_temp.ident('p2')),'revocation changes only one pair');
reset role;
select qc_private.operator_set_manager(pg_temp.ident('first'),pg_temp.ident('m1')::text||'@example.test',false);
set local role authenticated;
select pg_temp.as_actor('m1');
do $$ begin
  begin perform public.qc_university_roster(); raise exception 'Revoked manager read roster';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$begin
  begin perform public.qc_university_roster(); raise exception 'Anonymous roster read'; exception when insufficient_privilege then null; end;
end $$;
rollback;
