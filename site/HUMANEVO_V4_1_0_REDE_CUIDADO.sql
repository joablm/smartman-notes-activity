-- HUMANEVO V4.1.0 - REDE DE CUIDADO E INFORMACOES EDUCACIONAIS
-- Execute no SQL Editor do Supabase uma unica vez.

create extension if not exists pgcrypto;

create table if not exists public.humanevo_patient_education (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null references public.humanevo_patients(id) on delete cascade,
  school_name text not null default '',
  education_level text not null default '',
  education_stage text not null default '',
  school_year text not null default '',
  class_name text not null default '',
  school_shift text not null default '',
  school_type text not null default '',
  school_city text not null default '',
  school_state text not null default '',
  school_phone text not null default '',
  school_email text not null default '',
  teacher_name text not null default '',
  coordinator_name text not null default '',
  enrollment_date date,
  learning_difficulties text not null default '',
  school_history text not null default '',
  special_support text not null default '',
  school_contact_authorized boolean not null default false,
  school_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique (clinic_id, patient_id)
);

create table if not exists public.humanevo_patient_caregivers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null references public.humanevo_patients(id) on delete cascade,
  relationship text not null default 'responsible',
  relationship_other text not null default '',
  full_name text not null default '',
  cpf text not null default '',
  rg text not null default '',
  birth_date date,
  phone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  profession text not null default '',
  same_address boolean not null default true,
  address text not null default '',
  legal_guardian boolean not null default false,
  financial_responsible boolean not null default false,
  main_contact boolean not null default false,
  emergency_contact boolean not null default false,
  authorized_clinical_info boolean not null default false,
  authorized_pickup boolean not null default false,
  status text not null default 'active',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create index if not exists humanevo_patient_caregivers_patient_idx on public.humanevo_patient_caregivers(clinic_id,patient_id,sort_order);

alter table public.humanevo_patient_education enable row level security;
alter table public.humanevo_patient_caregivers enable row level security;

-- Funcao auxiliar: somente administrador e psicologo aprovados da mesma clinica.
create or replace function public.humanevo_can_access_sensitive_patient_data(target_clinic uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.humanevo_memberships m
    where m.user_id=auth.uid()
      and m.clinic_id=target_clinic
      and m.status='approved'
      and lower(m.role) in ('administrator','admin','psychologist','professional')
  );
$$;

revoke all on function public.humanevo_can_access_sensitive_patient_data(uuid) from public;
grant execute on function public.humanevo_can_access_sensitive_patient_data(uuid) to authenticated;

 drop policy if exists hv_education_sensitive_access on public.humanevo_patient_education;
create policy hv_education_sensitive_access on public.humanevo_patient_education
for all to authenticated
using (public.humanevo_can_access_sensitive_patient_data(clinic_id))
with check (public.humanevo_can_access_sensitive_patient_data(clinic_id));

 drop policy if exists hv_caregivers_sensitive_access on public.humanevo_patient_caregivers;
create policy hv_caregivers_sensitive_access on public.humanevo_patient_caregivers
for all to authenticated
using (public.humanevo_can_access_sensitive_patient_data(clinic_id))
with check (public.humanevo_can_access_sensitive_patient_data(clinic_id));

create or replace function public.humanevo_get_patient_care_network(target_patient_email text)
returns table(education jsonb, caregivers jsonb)
language plpgsql security definer set search_path=public
as $$
declare
  v_clinic uuid;
  v_patient uuid;
begin
  select m.clinic_id into v_clinic
  from public.humanevo_memberships m
  where m.user_id=auth.uid() and m.status='approved'
    and lower(m.role) in ('administrator','admin','psychologist','professional')
  limit 1;
  if v_clinic is null then raise exception 'Acesso restrito ao Administrador e Psicologo'; end if;

  select p.id into v_patient from public.humanevo_patients p
  where p.clinic_id=v_clinic and lower(coalesce(p.email,''))=lower(trim(target_patient_email)) limit 1;
  if v_patient is null then raise exception 'Paciente nao encontrado pelo e-mail informado'; end if;

  return query
  select
    coalesce((select jsonb_build_object(
      'schoolName',e.school_name,'educationLevel',e.education_level,'educationStage',e.education_stage,
      'schoolYear',e.school_year,'className',e.class_name,'schoolShift',e.school_shift,'schoolType',e.school_type,
      'schoolCity',e.school_city,'schoolState',e.school_state,'schoolPhone',e.school_phone,'schoolEmail',e.school_email,
      'teacherName',e.teacher_name,'coordinatorName',e.coordinator_name,'enrollmentDate',e.enrollment_date,
      'learningDifficulties',e.learning_difficulties,'schoolHistory',e.school_history,'specialSupport',e.special_support,
      'schoolContactAuthorized',e.school_contact_authorized,'schoolNotes',e.school_notes
    ) from public.humanevo_patient_education e where e.clinic_id=v_clinic and e.patient_id=v_patient),'{}'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id',c.id,'relationship',c.relationship,'relationshipOther',c.relationship_other,'fullName',c.full_name,
      'cpf',c.cpf,'rg',c.rg,'birthDate',c.birth_date,'phone',c.phone,'whatsapp',c.whatsapp,'email',c.email,
      'profession',c.profession,'sameAddress',c.same_address,'address',c.address,'legalGuardian',c.legal_guardian,
      'financialResponsible',c.financial_responsible,'mainContact',c.main_contact,'emergencyContact',c.emergency_contact,
      'authorizedClinicalInfo',c.authorized_clinical_info,'authorizedPickup',c.authorized_pickup,'status',c.status,'notes',c.notes
    ) order by c.sort_order,c.created_at) from public.humanevo_patient_caregivers c where c.clinic_id=v_clinic and c.patient_id=v_patient),'[]'::jsonb);
end;
$$;

create or replace function public.humanevo_save_patient_care_network(target_patient_email text, education_data jsonb, caregivers_data jsonb)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_clinic uuid;
  v_patient uuid;
  item jsonb;
  idx integer:=0;
begin
  select m.clinic_id into v_clinic
  from public.humanevo_memberships m
  where m.user_id=auth.uid() and m.status='approved'
    and lower(m.role) in ('administrator','admin','psychologist','professional')
  limit 1;
  if v_clinic is null then raise exception 'Acesso restrito ao Administrador e Psicologo'; end if;

  select p.id into v_patient from public.humanevo_patients p
  where p.clinic_id=v_clinic and lower(coalesce(p.email,''))=lower(trim(target_patient_email)) limit 1;
  if v_patient is null then raise exception 'Salve primeiro o paciente com um e-mail valido'; end if;

  insert into public.humanevo_patient_education(
    clinic_id,patient_id,school_name,education_level,education_stage,school_year,class_name,school_shift,school_type,
    school_city,school_state,school_phone,school_email,teacher_name,coordinator_name,enrollment_date,
    learning_difficulties,school_history,special_support,school_contact_authorized,school_notes,updated_at,updated_by)
  values(
    v_clinic,v_patient,coalesce(education_data->>'schoolName',''),coalesce(education_data->>'educationLevel',''),
    coalesce(education_data->>'educationStage',''),coalesce(education_data->>'schoolYear',''),coalesce(education_data->>'className',''),
    coalesce(education_data->>'schoolShift',''),coalesce(education_data->>'schoolType',''),coalesce(education_data->>'schoolCity',''),
    upper(coalesce(education_data->>'schoolState','')),coalesce(education_data->>'schoolPhone',''),coalesce(education_data->>'schoolEmail',''),
    coalesce(education_data->>'teacherName',''),coalesce(education_data->>'coordinatorName',''),nullif(education_data->>'enrollmentDate','')::date,
    coalesce(education_data->>'learningDifficulties',''),coalesce(education_data->>'schoolHistory',''),coalesce(education_data->>'specialSupport',''),
    coalesce((education_data->>'schoolContactAuthorized')::boolean,false),coalesce(education_data->>'schoolNotes',''),now(),auth.uid())
  on conflict(clinic_id,patient_id) do update set
    school_name=excluded.school_name,education_level=excluded.education_level,education_stage=excluded.education_stage,
    school_year=excluded.school_year,class_name=excluded.class_name,school_shift=excluded.school_shift,school_type=excluded.school_type,
    school_city=excluded.school_city,school_state=excluded.school_state,school_phone=excluded.school_phone,school_email=excluded.school_email,
    teacher_name=excluded.teacher_name,coordinator_name=excluded.coordinator_name,enrollment_date=excluded.enrollment_date,
    learning_difficulties=excluded.learning_difficulties,school_history=excluded.school_history,special_support=excluded.special_support,
    school_contact_authorized=excluded.school_contact_authorized,school_notes=excluded.school_notes,updated_at=now(),updated_by=auth.uid();

  delete from public.humanevo_patient_caregivers where clinic_id=v_clinic and patient_id=v_patient;
  if jsonb_typeof(caregivers_data)='array' then
    for item in select * from jsonb_array_elements(caregivers_data) loop
      insert into public.humanevo_patient_caregivers(
        clinic_id,patient_id,relationship,relationship_other,full_name,cpf,rg,birth_date,phone,whatsapp,email,profession,
        same_address,address,legal_guardian,financial_responsible,main_contact,emergency_contact,authorized_clinical_info,
        authorized_pickup,status,notes,sort_order,updated_by)
      values(
        v_clinic,v_patient,coalesce(item->>'relationship','responsible'),coalesce(item->>'relationshipOther',''),coalesce(item->>'fullName',''),
        coalesce(item->>'cpf',''),coalesce(item->>'rg',''),nullif(item->>'birthDate','')::date,coalesce(item->>'phone',''),coalesce(item->>'whatsapp',''),
        coalesce(item->>'email',''),coalesce(item->>'profession',''),coalesce((item->>'sameAddress')::boolean,true),coalesce(item->>'address',''),
        coalesce((item->>'legalGuardian')::boolean,false),coalesce((item->>'financialResponsible')::boolean,false),
        coalesce((item->>'mainContact')::boolean,false),coalesce((item->>'emergencyContact')::boolean,false),
        coalesce((item->>'authorizedClinicalInfo')::boolean,false),coalesce((item->>'authorizedPickup')::boolean,false),
        coalesce(item->>'status','active'),coalesce(item->>'notes',''),idx,auth.uid());
      idx:=idx+1;
    end loop;
  end if;

  -- Auditoria resumida quando a tabela existir.
  begin
    insert into public.humanevo_audit_logs(clinic_id,user_id,action,entity_type,entity_id,details,created_at)
    values(v_clinic,auth.uid(),'update','patient_care_network',v_patient,jsonb_build_object('caregivers',idx,'education',education_data),now());
  exception when undefined_table or undefined_column then null;
  end;

  return jsonb_build_object('ok',true,'patient_id',v_patient,'caregivers_saved',idx,'version','4.1.0');
end;
$$;

revoke all on function public.humanevo_get_patient_care_network(text) from public;
revoke all on function public.humanevo_save_patient_care_network(text,jsonb,jsonb) from public;
grant execute on function public.humanevo_get_patient_care_network(text) to authenticated;
grant execute on function public.humanevo_save_patient_care_network(text,jsonb,jsonb) to authenticated;

grant select,insert,update,delete on public.humanevo_patient_education to authenticated;
grant select,insert,update,delete on public.humanevo_patient_caregivers to authenticated;

comment on table public.humanevo_patient_caregivers is 'Rede de cuidado: mae, pai, responsaveis legais, financeiros e contatos de emergencia.';
comment on table public.humanevo_patient_education is 'Dados escolares e educacionais protegidos do paciente.';
