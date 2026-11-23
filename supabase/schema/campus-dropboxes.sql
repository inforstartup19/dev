begin;

create table qc_private.drop_spaces (
  id uuid primary key,
  institution_id uuid not null,
  teacher_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 180),
  subject text not null check (length(subject)<=180),
  kind text not null check (kind in ('TR','TFG','TFM')),
  instructions text not null check (length(instructions)<=3000),
  opens_at timestamptz, due_at timestamptz not null,
  allow_revisions boolean not null,
  created_at timestamptz not null default now(),
  check (opens_at is null or opens_at<due_at),
  foreign key (institution_id,teacher_id) references qc_private.pilot_invites(institution_id,person_id),
  unique (institution_id,id)
);
create table qc_private.drop_slots (
  project_id uuid primary key default gen_random_uuid(),
  space_id uuid not null, institution_id uuid not null, student_id uuid not null,
  foreign key (institution_id,space_id) references qc_private.drop_spaces(institution_id,id),
  foreign key (institution_id,student_id) references qc_private.pilot_invites(institution_id,person_id),
  unique (space_id,student_id)
);
create index qc_drop_slots_student on qc_private.drop_slots(institution_id,student_id);
create index qc_drop_spaces_teacher on qc_private.drop_spaces(institution_id,teacher_id);
create table qc_private.drop_receipts (
  storage_name text primary key,
  project_id uuid not null references qc_private.drop_slots(project_id),
  submitted_at timestamptz not null,
  confirmed_at timestamptz not null default clock_timestamp(),
  check (qc_private.document_project(storage_name) is not null and qc_private.document_project(storage_name)=project_id)
);
create index qc_drop_receipts_slot on qc_private.drop_receipts(project_id,submitted_at);
alter table qc_private.drop_slots enable row level security;
alter table qc_private.drop_spaces enable row level security;
alter table qc_private.drop_receipts enable row level security;
revoke all on qc_private.drop_spaces,qc_private.drop_slots,qc_private.drop_receipts from public,anon,authenticated,service_role;
alter table public.qc_projects add column drop_space_id uuid references qc_private.drop_spaces(id);
create index qc_projects_drop_space on public.qc_projects(drop_space_id) where drop_space_id is not null;
-- Existing column-scoped write grants exclude drop_space_id.

create function qc_private.drop_reserved(p_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from qc_private.drop_slots where project_id=p_project)
$$;
create policy qc_drop_reserved_project on public.qc_projects as restrictive for insert to authenticated
  with check (not qc_private.drop_reserved(id));
-- A single-project legacy tutor must not acquire access to a new project.
create view qc_private.drop_pairs with (security_invoker=true) as
 select l.institution_id,l.teacher_id,l.student_id,t.accepted_by as teacher_user,s.accepted_by as student_user,s.email as student_label,s.status
 from qc_private.university_links l
 join qc_private.university_people t on t.institution_id=l.institution_id and t.person_id=l.teacher_id and t.role='teacher'
 join qc_private.university_people s on s.institution_id=l.institution_id and s.person_id=l.student_id and s.role='student'
 where t.status='active' and l.mode in ('supervise','evaluate');
revoke all on qc_private.drop_pairs from public,anon,authenticated,service_role;

create function qc_private.drop_create(p_id uuid,p_title text,p_subject text,p_kind text,p_instructions text,
  p_opens_at timestamptz,p_due_at timestamptz,p_allow_revisions boolean,p_student_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare
  teacher qc_private.university_people;
  saved qc_private.drop_spaces;
  requested uuid[];
begin
  select * into teacher from qc_private.university_people where accepted_by=auth.uid() and role='teacher';
  if not found then raise exception 'Teacher access required' using errcode='42501'; end if;
  if p_id is null or p_title is null or length(btrim(p_title)) not between 1 and 180 or length(btrim(p_subject))>180
    or p_kind is null or p_kind not in ('TR','TFG','TFM') or length(btrim(p_instructions))>3000
    or p_due_at is null or not isfinite(p_due_at) or not coalesce(isfinite(p_opens_at),true)
    or p_due_at<=p_opens_at or p_allow_revisions is null or coalesce(cardinality(p_student_ids),0) not between 1 and 250
    or array_ndims(p_student_ids)<>1 or array_position(p_student_ids,null) is not null then
    raise exception 'Invalid delivery space' using errcode='22023';
  end if;
  select array_agg(distinct x order by x) into requested from unnest(p_student_ids) x;
  -- The manager takes an exclusive lock on this same centre for assignment changes.
  perform id from qc_private.universities where id=teacher.institution_id for share;
  if exists(select from unnest(requested) x where not exists(
     select from qc_private.drop_pairs where teacher_user=auth.uid() and student_id=x and institution_id=teacher.institution_id)) then
    raise exception 'Assigned students required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,9123201));
  select * into saved from qc_private.drop_spaces where id=p_id;
  if found then
    if saved.teacher_id=teacher.person_id and saved.institution_id=teacher.institution_id
      and (saved.title,saved.subject,saved.kind,saved.instructions,saved.opens_at,saved.due_at,saved.allow_revisions)
       is not distinct from (btrim(p_title),coalesce(btrim(p_subject),''),p_kind,coalesce(btrim(p_instructions),''),p_opens_at,p_due_at,p_allow_revisions)
      and requested=(select array_agg(student_id order by student_id) from qc_private.drop_slots where space_id=p_id) then
      return saved.id;
    end if;
    raise exception 'Delivery space request conflict' using errcode='40001';
  end if;
  if p_due_at<=clock_timestamp() then raise exception 'Deadline must be in the future' using errcode='22023'; end if;
  insert into qc_private.drop_spaces(id,institution_id,teacher_id,title,subject,kind,instructions,opens_at,due_at,allow_revisions)
  values(p_id,teacher.institution_id,teacher.person_id,btrim(p_title),coalesce(btrim(p_subject),''),p_kind,
    coalesce(btrim(p_instructions),''),p_opens_at,p_due_at,p_allow_revisions);
  insert into qc_private.drop_slots(space_id,institution_id,student_id) select p_id,teacher.institution_id,x from unnest(requested) x;
  return p_id;
end $$;

-- NULL means the file belongs to an ordinary project and follows the existing orientation policy.
create function qc_private.drop_upload_allowed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from qc_private.drop_pairs a where a.institution_id=s.institution_id and a.teacher_id=s.teacher_id
    and a.student_id=k.student_id and a.student_user=auth.uid())
    and statement_timestamp()>=coalesce(s.opens_at,s.created_at) and statement_timestamp()<=s.due_at
    and (s.allow_revisions or not exists(select from qc_private.drop_receipts r where r.project_id=k.project_id))
  from qc_private.drop_slots k join qc_private.drop_spaces s on s.id=k.space_id
  where k.project_id=qc_private.document_project(p_path)
$$;
create policy qc_drop_upload on storage.objects for insert to authenticated with check
  (bucket_id='qc-campus-documents' and owner_id=(select auth.uid())::text and qc_private.drop_upload_allowed(name));
alter policy qc_document_orientation_insert on storage.objects with check
  (bucket_id<>'qc-campus-documents' or coalesce(qc_private.drop_upload_allowed(name),qc_private.document_orientation_allows_upload(name)));
-- Slot objects are immutable. A future update policy for ordinary documents must not allow replacement here.
alter policy qc_document_orientation_update on storage.objects using
  (bucket_id<>'qc-campus-documents' or not qc_private.drop_reserved(qc_private.document_project(name))) with check
  (bucket_id<>'qc-campus-documents' or (not qc_private.drop_reserved(qc_private.document_project(name)) and qc_private.document_orientation_allows_upload(name)));

create function qc_private.drop_student_object(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from qc_private.drop_slots k join qc_private.university_people s
    on s.institution_id=k.institution_id and s.person_id=k.student_id and s.role='student'
    where k.project_id=qc_private.document_project(p_path) and s.accepted_by=auth.uid())
$$;
create function qc_private.drop_file_confirmed(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select from qc_private.drop_receipts where storage_name=p_path)
$$;
create policy qc_drop_own_file on storage.objects for select to authenticated using
  (bucket_id='qc-campus-documents' and owner_id=(select auth.uid())::text and qc_private.drop_student_object(name));
create policy qc_drop_private_pending on storage.objects as restrictive for select to authenticated using
  (bucket_id<>'qc-campus-documents' or not qc_private.drop_reserved(qc_private.document_project(name))
   or (owner_id=(select auth.uid())::text and qc_private.drop_student_object(name)) or qc_private.drop_file_confirmed(name));

create function qc_private.drop_confirm(p_space_id uuid,p_storage_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  learner qc_private.university_people;
  space qc_private.drop_spaces;
  slot qc_private.drop_slots;
  receipt qc_private.drop_receipts;
  stamp timestamptz;
  centre_name text;
begin
  select * into learner from qc_private.university_people where accepted_by=auth.uid() and role='student';
  if not found then raise exception 'Student access required' using errcode='42501'; end if;
  select name into centre_name from qc_private.universities where id=learner.institution_id for share;
  select s.* into space from qc_private.drop_spaces s join qc_private.drop_pairs a on a.institution_id=s.institution_id
    and a.teacher_id=s.teacher_id and a.student_id=learner.person_id and a.student_user=auth.uid() where s.id=p_space_id;
  if not found then raise exception 'Delivery unavailable' using errcode='42501'; end if;
  select * into slot from qc_private.drop_slots where space_id=p_space_id and student_id=learner.person_id for update;
  if not found or qc_private.document_project(p_storage_name) is distinct from slot.project_id then
    raise exception 'Delivery unavailable' using errcode='42501';
  end if;
  select * into receipt from qc_private.drop_receipts where storage_name=p_storage_name;
  if not found then
    select o.created_at into stamp from storage.objects o where o.bucket_id='qc-campus-documents'
      and o.name=p_storage_name and o.owner_id=auth.uid()::text;
    if stamp is null or stamp<coalesce(space.opens_at,space.created_at) or stamp>space.due_at then
      raise exception 'On-time private upload required' using errcode='22023'; end if;
    if not space.allow_revisions and exists(select from qc_private.drop_receipts where project_id=slot.project_id) then
      raise exception 'Delivery already received' using errcode='23505';
    end if;
    -- Student initiates the first upload. A failed upload or an invitation alone never creates an empty project.
    insert into public.qc_projects(id,owner_id,kind,title,university,drop_space_id)
      values(slot.project_id,auth.uid(),space.kind,space.title,centre_name,space.id) on conflict(id) do nothing;
    if not exists(select from public.qc_projects where id=slot.project_id and owner_id=auth.uid() and drop_space_id=space.id) then
      raise exception 'Project collision' using errcode='40001'; end if;
    insert into qc_private.drop_receipts(project_id,storage_name,submitted_at) values(slot.project_id,p_storage_name,stamp) returning * into receipt;
  end if;
  return jsonb_build_object('project_id',receipt.project_id,'storage_name',receipt.storage_name,'submitted_at',receipt.submitted_at);
end $$;

-- A pending upload is recoverable only by its author; it is not an input to academic analysis.
create function qc_private.drop_review_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if qc_private.drop_reserved(new.project_id) and not qc_private.drop_file_confirmed(new.project_id::text||'/'||new.storage_name) then
    raise exception 'A confirmed delivery is required' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function qc_private.drop_review_guard() from public,anon,authenticated,service_role;
create trigger qc_drop_review_guard before insert on public.qc_document_reviews for each row execute function qc_private.drop_review_guard();

create function qc_private.drop_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me qc_private.university_people; students jsonb; spaces jsonb;
begin
  select * into me from qc_private.university_people where accepted_by=auth.uid() and role in ('student','teacher');
  if not found then raise exception 'Academic membership required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.student_id,'label',a.student_label,'status',a.status)
    order by a.student_label,a.student_id),'[]'::jsonb) into students from qc_private.drop_pairs a
    where a.teacher_user=auth.uid() and a.institution_id=me.institution_id;
  with visible as materialized (
    select s.id,s.title,s.subject,s.kind,s.instructions,s.opens_at,s.due_at,s.allow_revisions,s.created_at,
      k.project_id,k.student_id,a.student_label
    from qc_private.drop_pairs a join qc_private.drop_spaces s on s.institution_id=a.institution_id and s.teacher_id=a.teacher_id
    join qc_private.drop_slots k on k.space_id=s.id and k.student_id=a.student_id
    where a.institution_id=me.institution_id and (a.teacher_user=auth.uid() or a.student_user=auth.uid())
  ), recipients as (
    select v.id,jsonb_agg(jsonb_build_object('id',v.student_id,'label',v.student_label,'project_id',v.project_id,
      'files',coalesce(fs.files,'[]'::jsonb),'pending',coalesce(ps.pending,'[]'::jsonb)) order by v.student_label,v.student_id) as rows
    from visible v
    left join lateral (
      select jsonb_agg(jsonb_build_object('storage_name',r.storage_name,'submitted_at',r.submitted_at)
        order by r.submitted_at desc,r.storage_name) as files from qc_private.drop_receipts r where r.project_id=v.project_id
    ) fs on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('storage_name',o.name,'uploaded_at',o.created_at) order by o.created_at desc,o.name) as pending
      from storage.objects o where me.role='student' and o.bucket_id='qc-campus-documents' and o.owner_id=auth.uid()::text
       and o.name like v.project_id::text||'/%' and qc_private.document_project(o.name)=v.project_id
       and o.created_at>=coalesce(v.opens_at,v.created_at) and o.created_at<=v.due_at and (v.allow_revisions or fs.files is null)
       and not exists(select from qc_private.drop_receipts r where r.storage_name=o.name)
    ) ps on true
    group by v.id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'subject',s.subject,'kind',s.kind,'instructions',s.instructions,
    'opens_at',s.opens_at,'due_at',s.due_at,'allow_revisions',s.allow_revisions,'recipients',r.rows)
    order by s.due_at,s.created_at,s.id),'[]'::jsonb) into spaces from recipients r join qc_private.drop_spaces s on s.id=r.id;
  return jsonb_build_object('students',students,'spaces',spaces);
end $$;

create function public.qc_drop_list() returns jsonb language sql stable security invoker set search_path='' as $$
  select qc_private.drop_list()
$$;
create function public.qc_drop_create(p_id uuid,p_title text,p_subject text,p_kind text,p_instructions text,
  p_opens_at timestamptz,p_due_at timestamptz,p_allow_revisions boolean,p_student_ids uuid[])
returns uuid language sql security invoker set search_path='' as $$
  select qc_private.drop_create(p_id,p_title,p_subject,p_kind,p_instructions,p_opens_at,p_due_at,p_allow_revisions,p_student_ids)
$$;
create function public.qc_drop_confirm(p_space_id uuid,p_storage_name text) returns jsonb language sql security invoker set search_path='' as $$
  select qc_private.drop_confirm(p_space_id,p_storage_name)
$$;
revoke all on function qc_private.drop_reserved(uuid),qc_private.drop_upload_allowed(text),qc_private.drop_student_object(text),
  qc_private.drop_file_confirmed(text),qc_private.drop_list(),qc_private.drop_create(uuid,text,text,text,text,timestamptz,timestamptz,boolean,uuid[]),
  qc_private.drop_confirm(uuid,text),public.qc_drop_list(),public.qc_drop_create(uuid,text,text,text,text,timestamptz,timestamptz,boolean,uuid[]),
  public.qc_drop_confirm(uuid,text) from public,anon,service_role;
grant execute on function qc_private.drop_reserved(uuid),qc_private.drop_upload_allowed(text),qc_private.drop_student_object(text),
  qc_private.drop_file_confirmed(text),qc_private.drop_list(),qc_private.drop_create(uuid,text,text,text,text,timestamptz,timestamptz,boolean,uuid[]),
  qc_private.drop_confirm(uuid,text),public.qc_drop_list(),public.qc_drop_create(uuid,text,text,text,text,timestamptz,timestamptz,boolean,uuid[]),
  public.qc_drop_confirm(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
