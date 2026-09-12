"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabaseClient";
import type { RecordType } from "@/lib/types";

type ScanResult = {
  data?: Record<string, any>;
  extracted_data?: Record<string, any>;
  [key: string]: any;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://aarogyavaani.onrender.com";

function normalizeDate(value: unknown): string | null {
  if (!value) return null;

  const text = String(value).trim();

  if (
    !text ||
    text.toLowerCase() === "unknown" ||
    text.toLowerCase() === "unknown date"
  ) {
    return null;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const match = text.match(
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/
  );

  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");

  let year = match[3];

  if (year.length === 2) {
    year = `20${year}`;
  }

  return `${year}-${month}-${day}`;
}

function normalizeRecordType(value: unknown): RecordType {
  const type = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  const allowed: RecordType[] = [
    "prescription",
    "lab_report",
    "doctor_visit",
    "diagnosis",
    "imaging",
    "vaccination",
    "discharge_summary",
    "other",
  ];

  return allowed.includes(type as RecordType)
    ? (type as RecordType)
    : "other";
}

function getExtractedData(result: ScanResult) {
  return result.data || result.extracted_data || result;
}

export default function ScanPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [result, setResult] = useState<ScanResult | null>(null);

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0] || null;

    setFile(selectedFile);
    setResult(null);
    setMessage("");
    setError("");
  };

  async function analyze() {
    if (!file) {
      setError("Please choose a document first.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError("Please choose a document smaller than 15 MB.");
      return;
    }

    setProcessing(true);
    setMessage("Uploading document securely…");
    setError("");
    setResult(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      let data: ScanResult;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "The scanner service returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "The document could not be analyzed."
        );
      }

      setResult(data);

      setMessage(
        "Extraction complete. Review the information before saving."
      );
    } catch (err) {
      console.error("Scanner error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "The scanner service is unavailable."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function saveRecord() {
    if (!result || !file) return;

    setSaving(true);
    setError("");
    setMessage("Saving your health record…");

    const supabase = createClient();

    let storagePath = "";
    let recordId = "";

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      /*
       * Find the patient's primary family profile.
       */
      let { data: familyMember, error: familyError } =
        await supabase
          .from("family_members")
          .select("id")
          .eq("owner_id", user.id)
          .eq("is_self", true)
          .single();

      if (familyError || !familyMember) {
        const { data: createdMember, error: createError } =
          await supabase
            .from("family_members")
            .insert({
              owner_id: user.id,
              name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "Me",
              relationship: "self",
              is_self: true,
            })
            .select("id")
            .single();

        if (createError || !createdMember) {
          throw new Error(
            "Could not create your primary family profile."
          );
        }

        familyMember = createdMember;
      }

      const extracted = getExtractedData(result);

      const recordType = normalizeRecordType(
        extracted.document_type ||
          extracted.record_type
      );

      const recordDate = normalizeDate(
        extracted.date ||
          extracted.record_date
      );

      const patientName =
        extracted.patient_name ||
        extracted.patient ||
        null;

      const doctorName =
        extracted.doctor_name ||
        extracted.doctor ||
        null;

      const diagnosis =
        extracted.diagnosis ||
        null;

      const medicines =
        Array.isArray(extracted.medicines)
          ? extracted.medicines
          : [];

      const labMetrics =
        Array.isArray(extracted.lab_metrics)
          ? extracted.lab_metrics
          : [];

      const title =
        extracted.title ||
        extracted.diagnosis ||
        (recordType === "prescription"
          ? "Prescription"
          : recordType === "lab_report"
            ? "Lab report"
            : "Scanned health record");

      /*
       * Store the original document privately.
       */
      const safeFilename = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      storagePath = `${user.id}/${crypto.randomUUID()}-${safeFilename}`;

      const { error: uploadError } = await supabase.storage
        .from("health-documents")
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Could not store the original document: ${uploadError.message}`
        );
      }

      /*
       * Create the structured health record.
       */
      const { data: record, error: recordError } =
        await supabase
          .from("health_records")
          .insert({
            family_member_id: familyMember.id,
            record_type: recordType,
            title,
            record_date: recordDate,
            doctor_name: doctorName,
            diagnosis,
            patient_name: patientName,
            medicines,
            lab_metrics: labMetrics,
            summary:
              extracted.summary ||
              "Structured from uploaded document.",
            metadata: {
              scanner: "AarogyaVaani Clinical Scanner",
              original_filename: file.name,
            },
            status: "processed",
            source: "patient_upload",
          })
          .select("id")
          .single();

      if (recordError || !record) {
        throw new Error(
          recordError?.message ||
            "Could not create the health record."
        );
      }

      recordId = record.id;

      /*
       * Connect the private original document
       * to the structured health record.
       */
      const { error: documentError } = await supabase
        .from("health_documents")
        .insert({
          health_record_id: record.id,
          storage_bucket: "health-documents",
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type || null,
          file_size_bytes: file.size,
        });

      if (documentError) {
        throw new Error(
          `Could not register the original document: ${documentError.message}`
        );
      }

      /*
       * Save extraction details separately.
       */
      const { error: extractionError } = await supabase
        .from("record_extractions")
        .insert({
          health_record_id: record.id,
          extraction_version: "v1",
          extracted_data: extracted,
          confidence:
            typeof extracted.confidence === "number"
              ? extracted.confidence
              : null,
          low_confidence_fields:
            Array.isArray(extracted.low_confidence_fields)
              ? extracted.low_confidence_fields
              : [],
          model_name:
            extracted.model_name ||
            "AarogyaVaani scanner",
          verified_by_patient: false,
        });

      if (extractionError) {
        throw new Error(
          `Could not save extraction details: ${extractionError.message}`
        );
      }

      /*
       * Add a timeline event.
       */
      const { error: timelineError } = await supabase
        .from("timeline_events")
        .insert({
          family_member_id: familyMember.id,
          health_record_id: record.id,
          event_type: "record_added",
          event_date: new Date().toISOString(),
          title: "Health record added",
          description:
            "Document processed through AarogyaVaani Clinical Scanner.",
          metadata: {
            source: "patient_upload",
          },
        });

      if (timelineError) {
        throw new Error(
          `Could not create timeline event: ${timelineError.message}`
        );
      }

      /*
       * Audit trail.
       */
      const {
  data: { user: auditUser },
  error: auditAuthError,
} = await supabase.auth.getUser();

console.error("========== AUDIT DEBUG ==========");
console.error("auditUser:", auditUser);
console.error("auditUser.id:", auditUser?.id);
console.error("auditAuthError:", auditAuthError);
console.error("current user.id:", user?.id);
console.error("familyMember.id:", familyMember?.id);
console.error("record.id:", record?.id);
console.error("=================================");

if (!auditUser?.id) {
  throw new Error(
    `No authenticated user available for audit log. Auth error: ${
      auditAuthError?.message ?? "none"
    }`
  );
}

const { error: auditError } = await supabase
  .from("audit_logs")
  .insert({
    actor_id: auditUser.id,
    actor_role: "patient",
    family_member_id: familyMember.id,
    health_record_id: record.id,
    action: "record_added",
    metadata: {
      source: "patient_upload",
      filename: file.name,
    },
  });

if (auditError) {
  console.error("AUDIT INSERT FAILED:", auditError);
  throw new Error(
    `Could not create audit entry: ${auditError.message}`
  );
}

      setMessage("Record saved successfully.");

      setTimeout(() => {
        router.push("/records");
      }, 500);
    } catch (err) {
      console.error("Save record error:", err);

      /*
       * Clean up the private file if the database
       * operation failed.
       */
      if (storagePath) {
        await supabase.storage
          .from("health-documents")
          .remove([storagePath]);
      }

      /*
       * If a record was created but a later operation
       * failed, remove the incomplete record.
       */
      if (recordId) {
        await supabase
          .from("health_records")
          .delete()
          .eq("id", recordId);
      }

      setError(
        err instanceof Error
          ? err.message
          : "Could not save the health record."
      );

      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const extracted = result
    ? getExtractedData(result)
    : null;

  return (
    <div className="app-content">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-name">
            Aarogya<span>Vaani</span>
          </div>

          <div className="brand-subtitle">
            Digital Health Locker
          </div>
        </div>

        <Link
          href="/records"
          className="profile-button"
          aria-label="Back to records"
        >
          ←
        </Link>
      </header>

      {/* Page heading */}
      <section>
        <p className="eyebrow">Clinical Scanner</p>

        <h1 className="page-title">
          Add a health record
        </h1>

        <p className="page-subtitle">
          Scan a prescription, lab report or medical document.
          We keep the original so you can verify the extracted
          information.
        </p>
      </section>

      {/* Upload card */}
      <section
        className="card"
        style={{ marginTop: 18 }}
      >
        <div className="card-padding">
          <div className="scanner-area">
            <div className="scanner-icon">
              +
            </div>

            <h2
              style={{
                margin: "0 0 5px",
                fontSize: 18,
                lineHeight: 1.3,
              }}
            >
              {file
                ? "Document selected"
                : "Scan or choose a document"}
            </h2>

            <p className="empty-text">
              {file
                ? file.name
                : "Use your phone camera or select a PDF, JPG or PNG."}
            </p>

            <label
              htmlFor="health-document"
              className="btn btn-secondary"
              style={{
                marginTop: 16,
                width: "100%",
              }}
            >
              {file
                ? "Choose another document"
                : "Choose document"}
            </label>

            <input
              id="health-document"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              }}
            />

            <p
              style={{
                margin: "10px 0 0",
                color: "var(--text-muted)",
                fontSize: 11,
              }}
            >
              Maximum file size: 15 MB
            </p>
          </div>

          {file ? (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "#fafcfc",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Selected document
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 13,
                  fontWeight: 600,
                  wordBreak: "break-word",
                }}
              >
                {file.name}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ marginTop: 14 }}
            disabled={!file || processing || saving}
            onClick={analyze}
          >
            {processing
              ? "Analyzing document…"
              : "Analyze document"}
          </button>
        </div>
      </section>

      {/* Success message */}
      {message ? (
        <div
          className="status status-success"
          style={{
            marginTop: 14,
            width: "100%",
            justifyContent: "center",
          }}
        >
          {message}
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div
          className="status status-danger"
          style={{
            marginTop: 14,
            width: "100%",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Review */}
      {extracted ? (
        <section
          className="card"
          style={{ marginTop: 18 }}
        >
          <div className="card-padding">
            <p className="eyebrow">
              Step 2 · Review
            </p>

            <h2
              style={{
                margin: 0,
                fontSize: 19,
              }}
            >
              Check extracted information
            </h2>

            <p className="page-subtitle">
              Review the information before it becomes part of
              your health record.
            </p>

            {/* Key fields */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 16,
              }}
            >
              <ReviewField
                label="Document type"
                value={
                  extracted.document_type ||
                  extracted.record_type ||
                  "Not detected"
                }
              />

              <ReviewField
                label="Patient"
                value={
                  extracted.patient_name ||
                  extracted.patient ||
                  "Not detected"
                }
              />

              <ReviewField
                label="Date"
                value={
                  extracted.date ||
                  extracted.record_date ||
                  "Not detected"
                }
              />

              <ReviewField
                label="Doctor"
                value={
                  extracted.doctor_name ||
                  extracted.doctor ||
                  "Not detected"
                }
              />

              <ReviewField
                label="Diagnosis"
                value={
                  extracted.diagnosis ||
                  "Not detected"
                }
              />

              {extracted.summary ? (
                <ReviewField
                  label="AI summary"
                  value={extracted.summary}
                />
              ) : null}
            </div>

            {/* Raw extraction */}
            <details
              style={{
                marginTop: 16,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--primary-dark)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Inspect extracted data
              </summary>

              <pre
                style={{
                  marginTop: 10,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 11,
                  lineHeight: 1.5,
                  background: "#f6f8f8",
                  padding: 12,
                  borderRadius: 10,
                  overflow: "auto",
                  maxHeight: 320,
                }}
              >
                {JSON.stringify(extracted, null, 2)}
              </pre>
            </details>

            {/* Save */}
            <button
              type="button"
              className="btn btn-primary btn-full"
              style={{ marginTop: 16 }}
              disabled={saving}
              onClick={saveRecord}
            >
              {saving
                ? "Saving securely…"
                : "Save to my health locker"}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-full"
              style={{ marginTop: 8 }}
              disabled={saving}
              onClick={() => {
                setResult(null);
                setMessage("");
                setError("");
              }}
            >
              Review another document
            </button>
          </div>
        </section>
      ) : null}

      {/* Verification notice */}
      <div className="disclaimer">
        <strong>Always verify important information.</strong>{" "}
        OCR and AI extraction can make mistakes. AarogyaVaani
        keeps the original document separately so you can compare
        extracted fields with the source. AI summaries are for
        understanding records and are not medical advice.
      </div>

      <BottomNav />
    </div>
  );
}

function ReviewField({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid var(--border-light)",
        borderRadius: 10,
        background: "#fafcfc",
      }}
    >
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {String(value || "Not detected")}
      </div>
    </div>
  );
}