begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('qc-campus-documents','qc-campus-documents',false,10485760,array['application/pdf']);
create function qc_private.document_project(path text) returns uuid language sql immutable security invoker set search_path='' as $$
 select case when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}--[A-Za-z0-9_.-]+\.pdf$' then split_part(path,'/',1)::uuid else null end
$$;
revoke all on function qc_private.document_project(text) from public;
grant execute on function qc_private.document_project(text) to authenticated;
create policy qc_document_read on storage.objects for select to authenticated using(bucket_id='qc-campus-documents' and qc_private.member_role(qc_private.document_project(name)) is not null);
create policy qc_document_create on storage.objects for insert to authenticated with check(bucket_id='qc-campus-documents' and owner_id=(select auth.uid())::text and qc_private.member_role(qc_private.document_project(name)) is not null);
-- No UPDATE or DELETE grants through policies: every upload is a distinct immutable version.
commit;
