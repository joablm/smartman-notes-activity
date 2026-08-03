-- HUMANEVO PREMIUM STUDIO 3.4
-- Banco central para pacientes, formulários, respostas, notificações, agenda e evidências.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;
create schema if not exists humanevo_private;

create table if not exists public.humanevo_clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.humanevo_clinics (id,name,slug)
values ('11111111-1111-4111-8111-111111111111','Humanevo','humanevo')
on conflict (id) do update set name=excluded.name, slug=excluded.slug;

create table if not exists public.humanevo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.humanevo_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  user_id uuid not null references public.humanevo_profiles(id) on delete cascade,
  role text not null default 'patient' check (role in ('administrator','psychologist','intake_manager','patient')),
  status text not null default 'pending' check (status in ('pending','approved','inactive','blocked')),
  professional_registration text,
  approved_by uuid references public.humanevo_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(clinic_id,user_id)
);

create index if not exists humanevo_memberships_user_idx on public.humanevo_memberships(user_id);
create index if not exists humanevo_memberships_clinic_role_idx on public.humanevo_memberships(clinic_id,role,status);

create table if not exists public.humanevo_patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  user_id uuid unique references public.humanevo_profiles(id) on delete set null,
  created_by uuid references public.humanevo_profiles(id),
  responsible_professional_id uuid references public.humanevo_profiles(id),
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  birth_date date,
  demand text not null default '',
  process_status text not null default 'active',
  risk_level text not null default 'none' check (risk_level in ('none','low','moderate','high','critical')),
  diagnosis text not null default '',
  prognosis text not null default '',
  recommendation text not null default '',
  referral text not null default '',
  treatment_progress integer not null default 0 check (treatment_progress between 0 and 100),
  block_reason text not null default '',
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists humanevo_patients_clinic_idx on public.humanevo_patients(clinic_id,process_status);
create index if not exists humanevo_patients_user_idx on public.humanevo_patients(user_id);

create table if not exists public.humanevo_forms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  owner_id uuid references public.humanevo_profiles(id),
  external_key text,
  title text not null,
  category text not null default 'Customizado',
  description text not null default '',
  estimated_minutes integer not null default 10 check (estimated_minutes between 1 and 240),
  version text not null default '1.0',
  status text not null default 'active' check (status in ('draft','active','inactive')),
  questions jsonb not null default '[]'::jsonb,
  references_list jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(clinic_id,external_key)
);

create index if not exists humanevo_forms_clinic_idx on public.humanevo_forms(clinic_id,status);

create table if not exists public.humanevo_form_assignments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  form_id uuid not null references public.humanevo_forms(id) on delete cascade,
  patient_id uuid not null references public.humanevo_patients(id) on delete cascade,
  professional_id uuid not null references public.humanevo_profiles(id),
  status text not null default 'assigned' check (status in ('assigned','opened','in_progress','submitted','reviewed','cancelled')),
  message text not null default '',
  due_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists humanevo_assignments_patient_idx on public.humanevo_form_assignments(patient_id,status,created_at desc);
create index if not exists humanevo_assignments_clinic_idx on public.humanevo_form_assignments(clinic_id,status,created_at desc);

create table if not exists public.humanevo_form_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.humanevo_form_assignments(id) on delete cascade,
  patient_id uuid not null references public.humanevo_patients(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score_summary jsonb not null default '{}'::jsonb,
  professional_summary text not null default '',
  professional_recommendations text not null default '',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by uuid references public.humanevo_profiles(id),
  reviewed_at timestamptz
);

create index if not exists humanevo_responses_patient_idx on public.humanevo_form_responses(patient_id,submitted_at desc);

create table if not exists public.humanevo_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  recipient_user_id uuid not null references public.humanevo_profiles(id) on delete cascade,
  patient_id uuid references public.humanevo_patients(id) on delete cascade,
  assignment_id uuid references public.humanevo_form_assignments(id) on delete cascade,
  notification_type text not null default 'general',
  title text not null,
  message text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists humanevo_notifications_recipient_idx on public.humanevo_notifications(recipient_user_id,read_at,created_at desc);

create table if not exists public.humanevo_appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  patient_id uuid references public.humanevo_patients(id) on delete set null,
  professional_id uuid references public.humanevo_profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  session_type text not null default 'Consulta',
  mode text not null default 'Presencial',
  status text not null default 'pending' check (status in ('confirmed','pending','cancelled','completed')),
  location text not null default '',
  notes text not null default '',
  reminder text not null default '24h',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists humanevo_appointments_clinic_idx on public.humanevo_appointments(clinic_id,starts_at);
create index if not exists humanevo_appointments_patient_idx on public.humanevo_appointments(patient_id,starts_at);

create table if not exists public.humanevo_clinical_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  patient_id uuid not null references public.humanevo_patients(id) on delete cascade,
  professional_id uuid not null references public.humanevo_profiles(id),
  note_type text not null,
  title text not null,
  content text not null,
  patient_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.humanevo_evidence_files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.humanevo_clinics(id) on delete cascade,
  patient_id uuid not null references public.humanevo_patients(id) on delete cascade,
  uploaded_by uuid not null references public.humanevo_profiles(id),
  filename text not null,
  content_type text not null,
  size_bytes bigint not null default 0,
  storage_path text not null unique,
  visibility text not null default 'professional' check (visibility in ('professional','patient_shared','administrative')),
  created_at timestamptz not null default now()
);

create table if not exists public.humanevo_audit_events (
  id bigint generated always as identity primary key,
  clinic_id uuid references public.humanevo_clinics(id) on delete set null,
  actor_id uuid references public.humanevo_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.humanevo_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  target_role text;
begin
  target_role := case lower(coalesce(new.raw_user_meta_data->>'requested_role','patient'))
    when 'administrator' then 'administrator'
    when 'psychologist' then 'psychologist'
    when 'intake_manager' then 'intake_manager'
    else 'patient'
  end;
  insert into public.humanevo_profiles(id,full_name,email,phone)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(coalesce(new.email,''),'@',1)),coalesce(new.email,''),nullif(new.raw_user_meta_data->>'phone',''))
  on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,phone=coalesce(excluded.phone,humanevo_profiles.phone),updated_at=now();
  insert into public.humanevo_memberships(clinic_id,user_id,role,status)
  values('11111111-1111-4111-8111-111111111111',new.id,target_role,'pending')
  on conflict(clinic_id,user_id) do nothing;

  -- Quando o paciente cria o primeiro acesso, vincula automaticamente o cadastro clínico pré-existente pelo e-mail.
  if target_role='patient' and coalesce(new.email,'')<>'' then
    update public.humanevo_patients
       set user_id=new.id, updated_at=now()
     where id=(
       select p.id from public.humanevo_patients p
        where p.clinic_id='11111111-1111-4111-8111-111111111111'
          and p.user_id is null
          and lower(p.email)=lower(new.email)
        order by p.created_at
        limit 1
     );
  end if;
  return new;
end;
$$;

drop trigger if exists humanevo_on_auth_user_created on auth.users;
create trigger humanevo_on_auth_user_created
after insert or update of email,raw_user_meta_data on auth.users
for each row execute function public.humanevo_handle_new_user();

create or replace function humanevo_private.my_membership()
returns public.humanevo_memberships
language sql stable security definer set search_path=public
as $$ select m from public.humanevo_memberships m where m.user_id=auth.uid() and m.status='approved' order by m.created_at limit 1 $$;

create or replace function humanevo_private.has_role(target_clinic uuid, allowed_roles text[])
returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.humanevo_memberships m where m.user_id=auth.uid() and m.clinic_id=target_clinic and m.status='approved' and m.role=any(allowed_roles)) $$;

create or replace function humanevo_private.patient_owned(target_patient uuid)
returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.humanevo_patients p where p.id=target_patient and p.user_id=auth.uid()) $$;

revoke all on schema humanevo_private from public;
grant usage on schema humanevo_private to authenticated;
grant execute on function humanevo_private.my_membership() to authenticated;
grant execute on function humanevo_private.has_role(uuid,text[]) to authenticated;
grant execute on function humanevo_private.patient_owned(uuid) to authenticated;

create or replace function public.humanevo_assign_form(target_patient_id uuid,target_form_id uuid,target_due_at timestamptz default null,target_message text default '')
returns public.humanevo_form_assignments
language plpgsql security definer set search_path=public
as $$
declare
  p public.humanevo_patients%rowtype;
  f public.humanevo_forms%rowtype;
  a public.humanevo_form_assignments%rowtype;
begin
  select * into p from public.humanevo_patients where id=target_patient_id;
  select * into f from public.humanevo_forms where id=target_form_id;
  if not found or p.id is null or f.id is null then raise exception 'Paciente ou formulário não encontrado'; end if;
  if p.clinic_id<>f.clinic_id or not humanevo_private.has_role(p.clinic_id,array['administrator','psychologist']) then raise exception 'Acesso negado'; end if;
  insert into public.humanevo_form_assignments(clinic_id,form_id,patient_id,professional_id,due_at,message)
  values(p.clinic_id,f.id,p.id,auth.uid(),target_due_at,coalesce(target_message,'')) returning * into a;
  if p.user_id is not null then
    insert into public.humanevo_notifications(clinic_id,recipient_user_id,patient_id,assignment_id,notification_type,title,message,payload)
    values(p.clinic_id,p.user_id,p.id,a.id,'form_assigned','Novo formulário disponível',coalesce(nullif(target_message,''),f.title),jsonb_build_object('form_title',f.title,'due_at',target_due_at));
  end if;
  insert into public.humanevo_audit_events(clinic_id,actor_id,action,entity_type,entity_id,metadata)
  values(p.clinic_id,auth.uid(),'form_assigned','form_assignment',a.id::text,jsonb_build_object('patient_id',p.id,'form_id',f.id));
  return a;
end;
$$;

grant execute on function public.humanevo_assign_form(uuid,uuid,timestamptz,text) to authenticated;

create or replace function public.humanevo_save_form_draft(assignment_uuid uuid,response_answers jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path=public
as $$
declare a public.humanevo_form_assignments%rowtype;
begin
  select * into a from public.humanevo_form_assignments where id=assignment_uuid for update;
  if not found or not humanevo_private.patient_owned(a.patient_id) then raise exception 'Acesso negado'; end if;
  if a.status in ('submitted','reviewed','cancelled') then raise exception 'Formulário encerrado'; end if;
  insert into public.humanevo_form_responses(assignment_id,patient_id,answers,started_at,updated_at)
  values(a.id,a.patient_id,coalesce(response_answers,'{}'::jsonb),now(),now())
  on conflict(assignment_id) do update set answers=excluded.answers,updated_at=now();
  update public.humanevo_form_assignments set status='in_progress',opened_at=coalesce(opened_at,now()) where id=a.id;
end;
$$;

grant execute on function public.humanevo_save_form_draft(uuid,jsonb) to authenticated;

create or replace function public.humanevo_submit_form_response(assignment_uuid uuid,response_answers jsonb)
returns void
language plpgsql security definer set search_path=public
as $$
declare
  a public.humanevo_form_assignments%rowtype;
  p public.humanevo_patients%rowtype;
  f public.humanevo_forms%rowtype;
begin
  select * into a from public.humanevo_form_assignments where id=assignment_uuid for update;
  if not found or not humanevo_private.patient_owned(a.patient_id) then raise exception 'Acesso negado'; end if;
  if a.status in ('submitted','reviewed','cancelled') then raise exception 'Formulário encerrado'; end if;
  select * into p from public.humanevo_patients where id=a.patient_id;
  select * into f from public.humanevo_forms where id=a.form_id;
  insert into public.humanevo_form_responses(assignment_id,patient_id,answers,submitted_at,updated_at)
  values(a.id,a.patient_id,coalesce(response_answers,'{}'::jsonb),now(),now())
  on conflict(assignment_id) do update set answers=excluded.answers,submitted_at=now(),updated_at=now();
  update public.humanevo_form_assignments set status='submitted',submitted_at=now() where id=a.id;
  insert into public.humanevo_notifications(clinic_id,recipient_user_id,patient_id,assignment_id,notification_type,title,message,payload)
  values(a.clinic_id,a.professional_id,p.id,a.id,'form_submitted','Formulário respondido',p.full_name||' enviou '||f.title,jsonb_build_object('patient_name',p.full_name,'form_title',f.title));
  insert into public.humanevo_audit_events(clinic_id,actor_id,action,entity_type,entity_id)
  values(a.clinic_id,auth.uid(),'form_submitted','form_assignment',a.id::text);
end;
$$;

grant execute on function public.humanevo_submit_form_response(uuid,jsonb) to authenticated;

create or replace function public.humanevo_mark_notification_read(notification_uuid uuid)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  update public.humanevo_notifications set read_at=now() where id=notification_uuid and recipient_user_id=auth.uid();
end;
$$;

grant execute on function public.humanevo_mark_notification_read(uuid) to authenticated;

create or replace function public.humanevo_review_form_response(assignment_uuid uuid,summary_text text,recommendations_text text,release_to_patient boolean default false)
returns void
language plpgsql security definer set search_path=public
as $$
declare a public.humanevo_form_assignments%rowtype; p public.humanevo_patients%rowtype; f public.humanevo_forms%rowtype;
begin
  select * into a from public.humanevo_form_assignments where id=assignment_uuid for update;
  if not found or not humanevo_private.has_role(a.clinic_id,array['administrator','psychologist']) then raise exception 'Acesso negado'; end if;
  select * into p from public.humanevo_patients where id=a.patient_id;
  select * into f from public.humanevo_forms where id=a.form_id;
  update public.humanevo_form_responses set professional_summary=coalesce(summary_text,''),professional_recommendations=coalesce(recommendations_text,''),reviewed_by=auth.uid(),reviewed_at=now() where assignment_id=a.id;
  update public.humanevo_form_assignments set status='reviewed',reviewed_at=now(),released_at=case when release_to_patient then now() else null end where id=a.id;
  if release_to_patient and p.user_id is not null then
    insert into public.humanevo_notifications(clinic_id,recipient_user_id,patient_id,assignment_id,notification_type,title,message)
    values(a.clinic_id,p.user_id,p.id,a.id,'result_released','Resultado revisado disponível','O resultado de '||f.title||' foi revisado pelo profissional.');
  end if;
end;
$$;

grant execute on function public.humanevo_review_form_response(uuid,text,text,boolean) to authenticated;

create or replace function public.humanevo_upsert_patient(
  target_patient_id uuid default null,
  target_full_name text default '',
  target_email text default '',
  target_phone text default '',
  target_birth_date date default null,
  target_demand text default '',
  target_process_status text default 'active',
  target_risk_level text default 'none',
  target_diagnosis text default '',
  target_prognosis text default '',
  target_recommendation text default '',
  target_referral text default '',
  target_treatment_progress integer default 0,
  target_block_reason text default '',
  target_tags jsonb default '[]'::jsonb
)
returns public.humanevo_patients
language plpgsql security definer set search_path=public
as $$
declare
  target_clinic uuid;
  result_row public.humanevo_patients%rowtype;
  linked_user uuid;
begin
  select m.clinic_id into target_clinic
    from public.humanevo_memberships m
   where m.user_id=auth.uid()
     and m.status='approved'
     and m.role=any(array['administrator','psychologist','intake_manager'])
   order by m.created_at limit 1;
  if target_clinic is null then raise exception 'Acesso profissional não autorizado'; end if;
  if nullif(trim(coalesce(target_full_name,'')),'') is null then raise exception 'Informe o nome do paciente'; end if;

  select p.id into linked_user
    from public.humanevo_profiles p
    join public.humanevo_memberships m on m.user_id=p.id and m.clinic_id=target_clinic and m.role='patient'
   where lower(p.email)=lower(trim(coalesce(target_email,'')))
   order by p.created_at limit 1;

  if target_patient_id is null then
    insert into public.humanevo_patients(
      clinic_id,user_id,created_by,responsible_professional_id,full_name,email,phone,birth_date,demand,
      process_status,risk_level,diagnosis,prognosis,recommendation,referral,treatment_progress,block_reason,tags
    ) values(
      target_clinic,linked_user,auth.uid(),case when exists(select 1 from public.humanevo_memberships m where m.user_id=auth.uid() and m.role in ('administrator','psychologist')) then auth.uid() else null end,
      trim(target_full_name),lower(trim(coalesce(target_email,''))),trim(coalesce(target_phone,'')),target_birth_date,coalesce(target_demand,''),
      coalesce(nullif(target_process_status,''),'active'),coalesce(nullif(target_risk_level,''),'none'),coalesce(target_diagnosis,''),coalesce(target_prognosis,''),
      coalesce(target_recommendation,''),coalesce(target_referral,''),greatest(0,least(100,coalesce(target_treatment_progress,0))),coalesce(target_block_reason,''),coalesce(target_tags,'[]'::jsonb)
    ) returning * into result_row;
  else
    update public.humanevo_patients p set
      user_id=coalesce(p.user_id,linked_user), full_name=trim(target_full_name), email=lower(trim(coalesce(target_email,''))),
      phone=trim(coalesce(target_phone,'')), birth_date=target_birth_date, demand=coalesce(target_demand,''),
      process_status=coalesce(nullif(target_process_status,''),p.process_status), risk_level=coalesce(nullif(target_risk_level,''),p.risk_level),
      diagnosis=coalesce(target_diagnosis,''), prognosis=coalesce(target_prognosis,''), recommendation=coalesce(target_recommendation,''),
      referral=coalesce(target_referral,''), treatment_progress=greatest(0,least(100,coalesce(target_treatment_progress,0))),
      block_reason=coalesce(target_block_reason,''), tags=coalesce(target_tags,'[]'::jsonb), updated_at=now()
    where p.id=target_patient_id and p.clinic_id=target_clinic
    returning * into result_row;
    if result_row.id is null then raise exception 'Paciente não localizado nesta clínica'; end if;
  end if;
  insert into public.humanevo_audit_events(clinic_id,actor_id,action,entity_type,entity_id,metadata)
  values(target_clinic,auth.uid(),case when target_patient_id is null then 'patient_created' else 'patient_updated' end,'patient',result_row.id::text,jsonb_build_object('email',result_row.email));
  return result_row;
end;
$$;
grant execute on function public.humanevo_upsert_patient(uuid,text,text,text,date,text,text,text,text,text,text,text,integer,text,jsonb) to authenticated;

create or replace function public.humanevo_set_membership_status(target_user_id uuid,new_status text,new_role text default null)
returns void
language plpgsql security definer set search_path=public
as $$
declare target_clinic uuid;
begin
  select m.clinic_id into target_clinic from public.humanevo_memberships m
   where m.user_id=auth.uid() and m.status='approved' and m.role='administrator'
   order by m.created_at limit 1;
  if target_clinic is null then raise exception 'Somente administradores podem aprovar perfis'; end if;
  if new_status not in ('pending','approved','inactive','blocked') then raise exception 'Status inválido'; end if;
  if new_role is not null and new_role not in ('administrator','psychologist','intake_manager','patient') then raise exception 'Perfil inválido'; end if;
  update public.humanevo_memberships
     set status=new_status,
         role=coalesce(new_role,role),
         approved_by=case when new_status='approved' then auth.uid() else approved_by end,
         approved_at=case when new_status='approved' then now() else approved_at end
   where clinic_id=target_clinic and user_id=target_user_id;
  if not found then raise exception 'Perfil não localizado'; end if;
  insert into public.humanevo_audit_events(clinic_id,actor_id,action,entity_type,entity_id,metadata)
  values(target_clinic,auth.uid(),'membership_status_changed','membership',target_user_id::text,jsonb_build_object('status',new_status,'role',new_role));
end;
$$;
grant execute on function public.humanevo_set_membership_status(uuid,text,text) to authenticated;

-- API privileges limitados às tabelas Humanevo. As políticas RLS continuam sendo a autoridade final.
grant usage on schema public to authenticated;
grant select,insert,update,delete on table
  public.humanevo_clinics,
  public.humanevo_profiles,
  public.humanevo_memberships,
  public.humanevo_patients,
  public.humanevo_forms,
  public.humanevo_form_assignments,
  public.humanevo_form_responses,
  public.humanevo_notifications,
  public.humanevo_appointments,
  public.humanevo_clinical_notes,
  public.humanevo_evidence_files,
  public.humanevo_audit_events
  to authenticated;
grant usage,select on sequence public.humanevo_audit_events_id_seq to authenticated;

alter table public.humanevo_clinics enable row level security;
alter table public.humanevo_profiles enable row level security;
alter table public.humanevo_memberships enable row level security;
alter table public.humanevo_patients enable row level security;
alter table public.humanevo_forms enable row level security;
alter table public.humanevo_form_assignments enable row level security;
alter table public.humanevo_form_responses enable row level security;
alter table public.humanevo_notifications enable row level security;
alter table public.humanevo_appointments enable row level security;
alter table public.humanevo_clinical_notes enable row level security;
alter table public.humanevo_evidence_files enable row level security;
alter table public.humanevo_audit_events enable row level security;

-- Drop policies safely before recreation.
do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename like 'humanevo_%' loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create policy humanevo_clinics_member_select on public.humanevo_clinics for select to authenticated
using (exists(select 1 from public.humanevo_memberships m where m.clinic_id=humanevo_clinics.id and m.user_id=auth.uid()));

create policy humanevo_profiles_own_or_staff_select on public.humanevo_profiles for select to authenticated
using (id=auth.uid() or exists(select 1 from public.humanevo_memberships m where m.user_id=humanevo_profiles.id and humanevo_private.has_role(m.clinic_id,array['administrator','psychologist','intake_manager'])));
create policy humanevo_profiles_own_update on public.humanevo_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create policy humanevo_memberships_own_or_admin_select on public.humanevo_memberships for select to authenticated
using(user_id=auth.uid() or humanevo_private.has_role(clinic_id,array['administrator']));
create policy humanevo_memberships_admin_update on public.humanevo_memberships for update to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator'])) with check(humanevo_private.has_role(clinic_id,array['administrator']));

create policy humanevo_patients_staff_select on public.humanevo_patients for select to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']) or user_id=auth.uid());
create policy humanevo_patients_staff_insert on public.humanevo_patients for insert to authenticated
with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']));
create policy humanevo_patients_clinical_update on public.humanevo_patients for update to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist']) or (humanevo_private.has_role(clinic_id,array['intake_manager']) and created_by=auth.uid()))
with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']));
create policy humanevo_patients_admin_delete on public.humanevo_patients for delete to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator']));

create policy humanevo_forms_staff_select on public.humanevo_forms for select to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist']) or exists(select 1 from public.humanevo_form_assignments a join public.humanevo_patients p on p.id=a.patient_id where a.form_id=humanevo_forms.id and p.user_id=auth.uid()));
create policy humanevo_forms_clinician_insert on public.humanevo_forms for insert to authenticated
with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));
create policy humanevo_forms_clinician_update on public.humanevo_forms for update to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist'])) with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));
create policy humanevo_forms_admin_delete on public.humanevo_forms for delete to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator']));

create policy humanevo_assignments_staff_select on public.humanevo_form_assignments for select to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist']) or humanevo_private.patient_owned(patient_id));
create policy humanevo_assignments_clinician_insert on public.humanevo_form_assignments for insert to authenticated
with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));
create policy humanevo_assignments_clinician_update on public.humanevo_form_assignments for update to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist'])) with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));

create policy humanevo_responses_owner_or_staff_select on public.humanevo_form_responses for select to authenticated
using(humanevo_private.patient_owned(patient_id) or exists(select 1 from public.humanevo_form_assignments a where a.id=humanevo_form_responses.assignment_id and humanevo_private.has_role(a.clinic_id,array['administrator','psychologist'])));

create policy humanevo_notifications_own_select on public.humanevo_notifications for select to authenticated using(recipient_user_id=auth.uid());
create policy humanevo_notifications_own_update on public.humanevo_notifications for update to authenticated using(recipient_user_id=auth.uid()) with check(recipient_user_id=auth.uid());
create policy humanevo_notifications_staff_insert on public.humanevo_notifications for insert to authenticated with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']));

create policy humanevo_appointments_staff_select on public.humanevo_appointments for select to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']) or exists(select 1 from public.humanevo_patients p where p.id=humanevo_appointments.patient_id and p.user_id=auth.uid()));
create policy humanevo_appointments_staff_insert on public.humanevo_appointments for insert to authenticated with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']));
create policy humanevo_appointments_staff_update on public.humanevo_appointments for update to authenticated using(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager'])) with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']));
create policy humanevo_appointments_admin_delete on public.humanevo_appointments for delete to authenticated using(humanevo_private.has_role(clinic_id,array['administrator','psychologist','intake_manager']));

create policy humanevo_notes_clinician_select on public.humanevo_clinical_notes for select to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist']) or (patient_visible and humanevo_private.patient_owned(patient_id)));
create policy humanevo_notes_clinician_insert on public.humanevo_clinical_notes for insert to authenticated with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));
create policy humanevo_notes_clinician_update on public.humanevo_clinical_notes for update to authenticated using(humanevo_private.has_role(clinic_id,array['administrator','psychologist'])) with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));

create policy humanevo_files_staff_select on public.humanevo_evidence_files for select to authenticated
using(humanevo_private.has_role(clinic_id,array['administrator','psychologist']) or (visibility='patient_shared' and humanevo_private.patient_owned(patient_id)));
create policy humanevo_files_staff_insert on public.humanevo_evidence_files for insert to authenticated with check(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));
create policy humanevo_files_staff_delete on public.humanevo_evidence_files for delete to authenticated using(humanevo_private.has_role(clinic_id,array['administrator','psychologist']));

create policy humanevo_audit_admin_select on public.humanevo_audit_events for select to authenticated using(humanevo_private.has_role(clinic_id,array['administrator']));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('humanevo-evidences','humanevo-evidences',false,52428800,array['application/pdf','text/plain','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists humanevo_storage_insert on storage.objects;
drop policy if exists humanevo_storage_select on storage.objects;
drop policy if exists humanevo_storage_delete on storage.objects;
create policy humanevo_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='humanevo-evidences' and humanevo_private.has_role(((storage.foldername(name))[1])::uuid,array['administrator','psychologist']));
create policy humanevo_storage_select on storage.objects for select to authenticated
using(bucket_id='humanevo-evidences' and (humanevo_private.has_role(((storage.foldername(name))[1])::uuid,array['administrator','psychologist']) or exists(select 1 from public.humanevo_evidence_files f where f.storage_path=name and f.visibility='patient_shared' and humanevo_private.patient_owned(f.patient_id))));
create policy humanevo_storage_delete on storage.objects for delete to authenticated
using(bucket_id='humanevo-evidences' and humanevo_private.has_role(((storage.foldername(name))[1])::uuid,array['administrator','psychologist']));

-- Habilita alterações em tempo real para notificações e atribuições, se ainda não estiverem publicadas.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='humanevo_notifications') then
    alter publication supabase_realtime add table public.humanevo_notifications;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='humanevo_form_assignments') then
    alter publication supabase_realtime add table public.humanevo_form_assignments;
  end if;
end $$;

-- Depois de criar o usuário Joab em Authentication, execute o arquivo ATIVAR_ADMIN_JOAB.sql.
