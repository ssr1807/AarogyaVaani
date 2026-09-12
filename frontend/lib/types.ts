export type RecordType =
  | "prescription"
  | "lab_report"
  | "doctor_visit"
  | "diagnosis"
  | "imaging"
  | "vaccination"
  | "discharge_summary"
  | "other";

export type FamilyMember = {
  id: string;
  owner_id: string;
  name: string;
  relationship: string;
  date_of_birth: string | null;
  sex: string | null;
  blood_group: string | null;
  phone: string | null;
  is_self: boolean;
  created_at: string;
  updated_at: string;
};

export type HealthRecord = {
  id: string;
  family_member_id: string | null;

  record_type: RecordType;
  title: string;

  record_date: string | null;

  doctor_name: string | null;
  facility_name: string | null;
  diagnosis: string | null;
  summary: string | null;

  status: string;
  source: string;
  is_archived: boolean;

  patient_name: string | null;
  medicines: unknown[];
  lab_metrics: unknown[];
  metadata: Record<string, unknown>;

  legacy_prescription_id?: number | null;

  created_at: string;
  updated_at: string;
};