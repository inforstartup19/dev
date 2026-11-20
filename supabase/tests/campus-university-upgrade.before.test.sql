-- Disposable DB only. Run immediately BEFORE campus-university.sql.
begin;
create temporary table upgrade_people(k text primary key, who uuid unique not null default gen_random_uuid());
insert into upgrade_people(k) values('full'),('specific'),('pending'),('first'),('second');
grant select on upgrade_people to authenticated;
insert into auth.users(id,email,email_confirmed_at)
 select who,who||'@example.invalid',now() from upgrade_people where k<>'pending';
insert into qc_private.pilot_invites(email,role,supervise_all)
 select who||'@example.invalid',case when k in ('first','second') then 'student' else 'teacher' end,
   k in ('full','pending') from upgrade_people;
create temporary table upgrade_works(k text primary key, id uuid unique not null default gen_random_uuid(), student text not null);
insert into upgrade_works(k,student) values('one','first'),('two','second'),('three','second');
grant select on upgrade_works to authenticated;
set local role authenticated;
do $$
declare person record; work record;
begin
  for person in select * from upgrade_people where k<>'pending' loop
    perform set_config('request.jwt.claim.sub',person.who::text,true);
    if public.qc_accept_pilot() is null then raise exception 'FAIL fixture enrollment'; end if;
  end loop;
  for work in select w.id,p.who from upgrade_works w join upgrade_people p on p.k=w.student loop
    perform set_config('request.jwt.claim.sub',work.who::text,true);
    insert into public.qc_projects(id,owner_id,title,kind) values(work.id,work.who,'Synthetic project','TFG');
  end loop;
end $$;
reset role;
-- Historical exceptions: one removed project from an otherwise global tutor
-- and a single manually assigned project for a different tutor.
delete from public.qc_members where user_id=(select who from upgrade_people where k='full')
  and project_id=(select id from upgrade_works where k='three');
insert into public.qc_members(project_id,user_id,role)
 select w.id,p.who,'teacher' from upgrade_works w cross join upgrade_people p where w.k='two' and p.k='specific';
commit;
