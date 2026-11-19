-- Expand private originals to the Free plan ceiling, preserving MIME and RLS.
-- The separate Inc AI review ceiling remains 10 MiB.
do $$
begin
  update storage.buckets
     set file_size_limit = 52428800
   where id = 'qc-campus-documents' and public = false;
  if not found then
    raise exception 'Expected private qc-campus-documents bucket is missing';
  end if;
end $$;
