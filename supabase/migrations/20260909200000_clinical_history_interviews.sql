-- Clinical History Interview foundation for AarogyaVaani.
-- A confirmed interview can later be represented as a health_record so the
-- existing patient->doctor sharing model remains the source of truth.

create table if not exists public.clinical_interviews (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  language text not null default 'en-IN',
  input_mode text not null default 'touch',
  status text not null default 'draft',
  current_section text not null default 'chief_complaint',
  chief_complaint text,
  structured_history jsonb not null default '{}'::jsonb,
  summary text,
  red_flags jsonb not null default '[]'::jsonb,
  patient_verified boolean not null default false,
  verified_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_interviews_language_check check (language in ('en-IN','hi-IN')),
  constraint clinical_interviews_input_mode_check check (input_mode in ('voice','touch','mixed')),
  constraint clinical_interviews_status_check check (status in ('draft','review','confirmed','cancelled'))
);

create table if not exists public.clinical_interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.clinical_interviews(id) on delete cascade,
  section text not null,
  question_key text not null,
  question_text text not null,
  answer_text text,
  answer_source text not null default 'touch',
  answer_metadata jsonb not null default '{}'::jsonb,
  sequence_number integer not null,
  created_at timestamptz not null default now(),
  constraint clinical_interview_answers_source_check check (answer_source in ('voice','touch','typed'))
);

create index if not exists clinical_interviews_family_member_idx
  on public.clinical_interviews(family_member_id, created_at desc);
create index if not exists clinical_interview_answers_interview_idx
  on public.clinical_interview_answers(interview_id, sequence_number);

alter table public.clinical_interviews enable row level security;
alter table public.clinical_interview_answers enable row level security;

drop policy if exists clinical_interviews_patient_all on public.clinical_interviews;
drop policy if exists clinical_interview_answers_patient_all on public.clinical_interview_answers;

create policy clinical_interviews_patient_all
on public.clinical_interviews
for all
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.id = clinical_interviews.family_member_id
      and fm.owner_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.family_members fm
    where fm.id = clinical_interviews.family_member_id
      and fm.owner_id = auth.uid()
  )
);

create policy clinical_interview_answers_patient_all
on public.clinical_interview_answers
for all
to authenticated
using (
  exists (
    select 1
    from public.clinical_interviews ci
    join public.family_members fm on fm.id = ci.family_member_id
    where ci.id = clinical_interview_answers.interview_id
      and fm.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.clinical_interviews ci
    join public.family_members fm on fm.id = ci.family_member_id
    where ci.id = clinical_interview_answers.interview_id
      and fm.owner_id = auth.uid()
  )
);

-- Keep updated_at accurate without requiring client-side timestamp handling.
create or replace function public.set_clinical_interview_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinical_interviews_set_updated_at on public.clinical_interviews;
create trigger clinical_interviews_set_updated_at
before update on public.clinical_interviews
for each row execute function public.set_clinical_interview_updated_at();
