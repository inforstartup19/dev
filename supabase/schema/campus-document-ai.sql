begin;

-- Originals remain private, immutable and limited to 10 MiB. Neither a MIME
-- allowlist nor a filename check is an antimalware or full format inspection.
update storage.buckets set file_size_limit=10485760, allowed_mime_types=array[
 'application/pdf',
 'application/msword',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-powerpoint',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
] where id='qc-campus-documents' and public=false;

create or replace function qc_private.document_project(path text) returns uuid
language sql immutable security invoker set search_path='' as $$
 select case when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}--[A-Za-z0-9_.-]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$'
 then split_part(path,'/',1)::uuid else null end
$$;

create table public.qc_document_reviews (
 id uuid primary key,
 project_id uuid not null references public.qc_projects(id),
 storage_name text not null check(length(storage_name) between 1 and 220),
 requested_by uuid not null references auth.users(id),
 document_sha256 text not null check(document_sha256 ~ '^[0-9a-f]{64}$'),
 document_size bigint not null check(document_size between 1 and 10485760),
 question text not null check(length(question)<=2000 and question=trim(question)),
 model text not null check(length(model) between 1 and 120 and model ~ '^[A-Za-z0-9._:-]+$'),
 status text not null default 'processing' check(status in ('processing','completed','failed')),
 result jsonb,
 error_code text check(error_code ~ '^[a-z0-9_]{1,80}$'),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check(qc_private.document_project(project_id::text||'/'||storage_name) is not null
  and qc_private.document_project(project_id::text||'/'||storage_name)=project_id),
 check(
  (status='processing' and result is null and error_code is null and completed_at is null)
  or (status='completed' and result is not null and jsonb_typeof(result)='object'
      and octet_length(result::text)<=131072 and error_code is null and completed_at is not null)
  or (status='failed' and result is null and error_code is not null and completed_at is not null)
 )
);
create index qc_document_reviews_project_idx on public.qc_document_reviews(project_id,created_at desc);
create index qc_document_reviews_actor_idx on public.qc_document_reviews(requested_by,created_at desc);
create unique index qc_document_reviews_processing_idx on public.qc_document_reviews(project_id) where status='processing';
alter table public.qc_document_reviews enable row level security;
revoke all on public.qc_document_reviews from public,anon,authenticated,service_role;
grant select on public.qc_document_reviews to authenticated;
create policy qc_document_review_read on public.qc_document_reviews for select to authenticated
 using(qc_private.member_role(project_id) is not null);

-- These explicit-actor checks are callable only through the service RPCs below.
-- The Edge Function must obtain actor_id from Auth getUser(token), never JSON.
create function qc_private.document_review_actor(p_project_id uuid,p_actor_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.qc_projects pr
  join public.qc_pilot_people p on p.user_id=p_actor_id and p.active
  where pr.id=p_project_id
   and exists(select 1 from qc_private.pilot_invites i where i.accepted_by=p_actor_id and i.revoked_at is null)
   and ((pr.owner_id=p_actor_id and p.role='student')
    or exists(select 1 from public.qc_members m where m.project_id=pr.id and m.user_id=p_actor_id and m.role=p.role))
 )
$$;
revoke all on function qc_private.document_review_actor(uuid,uuid) from public,anon,authenticated,service_role;

create function qc_private.claim_document_review(
 p_id uuid,p_project_id uuid,p_storage_name text,p_actor_id uuid,
 p_document_sha256 text,p_document_size bigint,p_question text,p_model text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.qc_document_reviews; stamp timestamptz:=clock_timestamp();
begin
 p_question:=trim(p_question);
 if p_id is null or p_project_id is null or p_actor_id is null
  or p_storage_name is null or length(p_storage_name) not between 1 and 220
  or qc_private.document_project(p_project_id::text||'/'||p_storage_name) is distinct from p_project_id
  or p_document_sha256 is null or p_document_sha256 !~ '^[0-9a-f]{64}$'
  or p_document_size is null or p_document_size not between 1 and 10485760
  or p_question is null or length(p_question)>2000
  or p_model is null or length(p_model) not between 1 and 120 or p_model !~ '^[A-Za-z0-9._:-]+$'
 then raise exception 'Invalid review request' using errcode='22023';end if;
 if not qc_private.document_review_actor(p_project_id,p_actor_id) then
  raise exception 'Project access denied' using errcode='42501';end if;
 -- Serialize idempotency, per-actor quotas and the project lease in that order.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qc_review_id:'||p_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qc_review_actor:'||p_actor_id::text,0));
 perform 1 from public.qc_projects where id=p_project_id for update;
 stamp:=clock_timestamp();
 if not qc_private.document_review_actor(p_project_id,p_actor_id) then
  raise exception 'Project access denied' using errcode='42501';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='qc-campus-documents'
   and o.name=p_project_id::text||'/'||p_storage_name and o.metadata->>'size'=p_document_size::text)
 then raise exception 'Document unavailable' using errcode='42501';end if;
 select * into r from public.qc_document_reviews where id=p_id for update;
 if found then
  if r.project_id<>p_project_id or r.storage_name<>p_storage_name or r.requested_by<>p_actor_id
   or r.document_sha256<>p_document_sha256 or r.document_size<>p_document_size
   or r.question<>p_question or r.model<>p_model
  then raise exception 'Review request ID conflict' using errcode='23505';end if;
  if r.status='processing' and r.created_at<=stamp-interval '120 seconds' then
   update public.qc_document_reviews set status='failed',error_code='lease_expired',completed_at=stamp
    where id=r.id returning * into r;
  end if;
  return jsonb_build_object('claimed',false,'review',to_jsonb(r));
 end if;
 if (select count(*) from public.qc_document_reviews where requested_by=p_actor_id and created_at>stamp-interval '1 hour')>=10
 then raise exception 'Review rate limit exceeded';end if;
 update public.qc_document_reviews set status='failed',error_code='lease_expired',completed_at=stamp
  where project_id=p_project_id and status='processing' and created_at<=stamp-interval '120 seconds';
 if exists(select 1 from public.qc_document_reviews where project_id=p_project_id and status='processing')
 then raise exception 'Review already processing';end if;
 insert into public.qc_document_reviews(id,project_id,storage_name,requested_by,document_sha256,document_size,question,model,created_at)
 values(p_id,p_project_id,p_storage_name,p_actor_id,p_document_sha256,p_document_size,p_question,p_model,stamp)
 returning * into r;
 return jsonb_build_object('claimed',true,'review',to_jsonb(r));
end $$;
revoke all on function qc_private.claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function qc_private.claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text) to service_role;

create function qc_private.finish_document_review(
 p_id uuid,p_actor_id uuid,p_status text,p_result jsonb,p_error_code text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.qc_document_reviews; stamp timestamptz:=clock_timestamp();
begin
 if p_status is null or p_status not in ('completed','failed')
  or (p_status='completed' and (p_result is null or jsonb_typeof(p_result)<>'object'
      or octet_length(p_result::text)>131072 or p_error_code is not null))
  or (p_status='failed' and (p_result is not null or p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$'))
 then raise exception 'Invalid review result' using errcode='22023';end if;
 select * into r from public.qc_document_reviews where id=p_id for update;
 if not found or r.requested_by is distinct from p_actor_id
  or not qc_private.document_review_actor(r.project_id,p_actor_id)
 then raise exception 'Project access denied' using errcode='42501';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='qc-campus-documents'
   and o.name=r.project_id::text||'/'||r.storage_name and o.metadata->>'size'=r.document_size::text)
 then raise exception 'Document unavailable' using errcode='42501';end if;
 if r.status<>'processing' then raise exception 'Review is no longer processing';end if;
 if r.created_at<=stamp-interval '120 seconds' then raise exception 'Review lease expired';end if;
 update public.qc_document_reviews set status=p_status,result=p_result,error_code=p_error_code,completed_at=stamp
  where id=p_id returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function qc_private.finish_document_review(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function qc_private.finish_document_review(uuid,uuid,text,jsonb,text) to service_role;

grant usage on schema qc_private to service_role;
create function public.qc_claim_document_review(
 p_id uuid,p_project_id uuid,p_storage_name text,p_actor_id uuid,
 p_document_sha256 text,p_document_size bigint,p_question text,p_model text
) returns jsonb language sql security invoker set search_path='' as $$
 select qc_private.claim_document_review(p_id,p_project_id,p_storage_name,p_actor_id,p_document_sha256,p_document_size,p_question,p_model)
$$;
revoke all on function public.qc_claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.qc_claim_document_review(uuid,uuid,text,uuid,text,bigint,text,text) to service_role;
create function public.qc_finish_document_review(p_id uuid,p_actor_id uuid,p_status text,p_result jsonb,p_error_code text)
returns jsonb language sql security invoker set search_path='' as $$
 select qc_private.finish_document_review(p_id,p_actor_id,p_status,p_result,p_error_code)
$$;
revoke all on function public.qc_finish_document_review(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.qc_finish_document_review(uuid,uuid,text,jsonb,text) to service_role;

comment on table public.qc_document_reviews is 'Private advisory AI reviews; originals and results are never automatically added to the library. Service RPCs accept only an actor verified by the backend.';
commit;
