-- Clinical History creates patient-owned health_records with source=clinical_interview.
-- Keep the source constraint explicit so fresh environments match the live schema.
alter table public.health_records
drop constraint if exists health_records_source_check;

alter table public.health_records
add constraint health_records_source_check
check (source = any (array[
  'patient_upload'::text,
  'doctor_portal'::text,
  'kiosk'::text,
  'imported'::text,
  'demo'::text,
  'clinical_interview'::text
]));
