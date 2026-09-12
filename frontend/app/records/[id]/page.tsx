"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabaseClient";
import type { HealthRecord } from "@/lib/types";

type HealthDocument = {
  id: string;
  health_record_id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
};

type RecordExtraction = {
  id: string;
  health_record_id: string;
  extraction_version: string;
  extracted_data: Record<string, any>;
  confidence: number | null;
  low_confidence_fields: unknown[];
  model_name: string | null;
  extracted_at: string;
  verified_by_patient: boolean;
  verified_at: string | null;
};

type TimelineEvent = {
  id: string;
  event_type: string;
  event_date: string;
  title: string;
  description: string | null;
};

const recordTypeLabels: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab report",
  doctor_visit: "Doctor visit",
  diagnosis: "Diagnosis",
  imaging: "Imaging",
  vaccination: "Vaccination",
  discharge_summary: "Discharge summary",
  other: "Health record",
};

function formatDate(
  date: string | null | undefined
) {
  if (!date) return "Date not available";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(
  date: string | null | undefined
) {
  if (!date) return "Date not available";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(
  bytes: number | null
) {
  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getConfidenceLabel(
  confidence: number | null
) {
  if (confidence === null) {
    return "Not available";
  }

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  if (percentage >= 90) {
    return "High confidence";
  }

  if (percentage >= 70) {
    return "Moderate confidence";
  }

  return "Needs review";
}

function getConfidenceClass(
  confidence: number | null
) {
  if (confidence === null) {
    return "status-warning";
  }

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  if (percentage >= 90) {
    return "status-success";
  }

  return "status-warning";
}


type ClinicalHistoryItem = {
  key?: string;
  question: string;
  answer: string;
  source?: string;
};

const clinicalSectionLabels: Record<string, string> = {
  chief_complaint: "Chief Complaint",
  hpi: "History of Present Illness (HPI)",
  past_history: "Past Medical History",
  surgical_history: "Surgical History",
  medications_allergies: "Medications & Allergies",
  family_history: "Family History",
  personal_history: "Personal / Social History",
  review_of_systems: "Review of Systems",
};

const clinicalQuestionLabels: Record<string, string> = {
  "What is bothering you today?": "Patient's main concern",
  "Where do you feel the pain?": "Location",
  "When did it start?": "Onset",
  "How severe is it right now?": "Severity",
  "When did this problem begin?": "Problem began",
  "Since it started, has it been getting better, worse, or staying about the same?": "Course",
  "Are there any other symptoms you have noticed?": "Associated symptoms",
  "Is there anything else about this problem that you want the doctor to know?": "Additional information",
  "Have you ever been told by a doctor that you have a long-term medical condition?": "Long-term medical conditions",
  "Have you ever had an operation or surgery?": "Previous surgery",
  "Do you currently take any regular medicines?": "Regular medicines",
  "Does anyone in your close family have an important medical condition that the doctor should know about?": "Relevant family history",
  "Is there anything about your daily habits, sleep, food, or activity that the doctor should know?": "Daily habits / lifestyle",
  "Apart from what we have discussed, do you have any other symptoms you want to mention?": "Other symptoms",
};

function clinicalSectionLabel(section: string) {
  return clinicalSectionLabels[section] || section
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clinicalQuestionLabel(item: ClinicalHistoryItem) {
  if (item.key === "chief_complaint") return "Patient's main concern";
  return clinicalQuestionLabels[item.question] || item.question;
}

function cleanClinicalItems(items: ClinicalHistoryItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const answer = item.answer?.trim();
    if (!answer || answer === ".") return false;

    const identity = `${item.key || item.question}|${answer.toLowerCase()}`;
    if (seen.has(identity)) return false;

    seen.add(identity);
    return true;
  });
}

function buildClinicalSummary(
  structuredHistory: Record<string, ClinicalHistoryItem[]>
) {
  const complaint = cleanClinicalItems(
    structuredHistory.chief_complaint || []
  )[0]?.answer?.trim();

  const hpi = cleanClinicalItems(structuredHistory.hpi || []).filter(
    (item) => item.key !== "hpi_complete" &&
      !/anything else about this problem/i.test(item.question)
  );

  if (!complaint && hpi.length === 0) {
    return "No clinical history was recorded.";
  }

  const details = hpi
    .map((item) => `${clinicalQuestionLabel(item)}: ${item.answer.trim()}`)
    .join("; ");

  return [
    complaint ? `The patient reports ${complaint.toLowerCase()}.` : "",
    details ? `History of Present Illness: ${details}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();

  const supabase = createClient();

  const recordId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [loading, setLoading] = useState(true);
  const [record, setRecord] =
    useState<HealthRecord | null>(null);

  const [document, setDocument] =
    useState<HealthDocument | null>(null);

  const [extraction, setExtraction] =
    useState<RecordExtraction | null>(null);

  const [timeline, setTimeline] =
    useState<TimelineEvent[]>([]);

  const [documentUrl, setDocumentUrl] =
    useState("");

  const [verified, setVerified] =
    useState(false);

  const [savingVerification, setSavingVerification] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [currentUserId, setCurrentUserId] =
    useState("");
  const [doctorId, setDoctorId] =
    useState("");
  const [sharePermission, setSharePermission] =
    useState<"view" | "download">("view");
  const [shareDuration, setShareDuration] =
    useState<"24h" | "7d" | "none">("24h");
  const [sharing, setSharing] =
    useState(false);
  const [shares, setShares] =
    useState<Array<{
      id: string;
      doctor_id: string;
      permission: "view" | "download";
      status: string;
      expires_at: string | null;
      shared_at: string;
    }>>([]);

  useEffect(() => {
    if (!recordId) return;

    let mounted = true;

    async function loadRecord() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        setCurrentUserId(user.id);

        /*
         * First verify that the requested record belongs
         * to one of the authenticated user's family profiles.
         */
        const { data: members, error: membersError } =
          await supabase
            .from("family_members")
            .select("id")
            .eq("owner_id", user.id);

        if (membersError) {
          throw membersError;
        }

        const memberIds =
          (members ?? []).map(
            (member) => member.id
          );

        if (memberIds.length === 0) {
          throw new Error(
            "No family profile was found."
          );
        }

        /*
         * Fetch the health record only through an
         * authorized family member.
         */
        const { data: recordData, error: recordError } =
          await supabase
            .from("health_records")
            .select("*")
            .eq("id", recordId)
            .in("family_member_id", memberIds)
            .single();

        if (recordError || !recordData) {
          throw new Error(
            "This health record could not be found."
          );
        }

        if (!mounted) return;

        const typedRecord =
          recordData as HealthRecord;

        setRecord(typedRecord);

        /*
         * Load the original document metadata.
         */
        const { data: documentData } =
          await supabase
            .from("health_documents")
            .select("*")
            .eq("health_record_id", recordId)
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (!mounted) return;

        if (documentData) {
          const typedDocument =
            documentData as HealthDocument;

          setDocument(typedDocument);

          /*
           * Generate a short-lived signed URL for the
           * private original document.
           */
          if (
            typedDocument.storage_bucket &&
            typedDocument.storage_path
          ) {
            const { data: signedUrlData } =
              await supabase.storage
                .from(
                  typedDocument.storage_bucket
                )
                .createSignedUrl(
                  typedDocument.storage_path,
                  300
                );

            if (
              signedUrlData?.signedUrl &&
              mounted
            ) {
              setDocumentUrl(
                signedUrlData.signedUrl
              );
            }
          }
        }

        /*
         * Load the latest extraction.
         */
        const { data: extractionData } =
          await supabase
            .from("record_extractions")
            .select("*")
            .eq("health_record_id", recordId)
            .order("extracted_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (!mounted) return;

        if (extractionData) {
          const typedExtraction =
            extractionData as RecordExtraction;

          setExtraction(typedExtraction);
          setVerified(
            typedExtraction.verified_by_patient
          );
        }

        /*
         * Load timeline events.
         */
        const { data: timelineData } =
          await supabase
            .from("timeline_events")
            .select(
              "id,event_type,event_date,title,description"
            )
            .eq("health_record_id", recordId)
            .order("event_date", {
              ascending: false,
            });

        if (!mounted) return;

        setTimeline(
          (timelineData ?? []) as TimelineEvent[]
        );

        const { data: shareData } = await supabase
          .from("sharing_permissions")
          .select("id,doctor_id,permission,status,expires_at,shared_at")
          .eq("health_record_id", recordId)
          .eq("patient_id", user.id)
          .order("shared_at", { ascending: false });

        if (!mounted) return;
        setShares((shareData ?? []) as typeof shares);
      } catch (err) {
        console.error(
          "Record detail error:",
          err
        );

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load this record."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRecord();

    return () => {
      mounted = false;
    };
  }, [recordId, router]);

  async function verifyRecord() {
    if (!extraction) return;

    setSavingVerification(true);
    setMessage("");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const now = new Date().toISOString();

      const { error: updateError } =
        await supabase
          .from("record_extractions")
          .update({
            verified_by_patient: true,
            verified_at: now,
          })
          .eq("id", extraction.id);

      if (updateError) {
        throw updateError;
      }

      /*
       * Add an audit event so the verification action
       * becomes part of the record history.
       */
      const { error: auditError } =
        await supabase
          .from("audit_logs")
          .insert({
            actor_id: user.id,
            actor_role: "patient",
            health_record_id: recordId,
            action: "extraction_verified",
            metadata: {
              verified_at: now,
            },
          });

      if (auditError) {
        console.error(
          "Audit verification error:",
          auditError
        );
      }

      setVerified(true);

      setExtraction((current) =>
        current
          ? {
              ...current,
              verified_by_patient: true,
              verified_at: now,
            }
          : current
      );

      setMessage(
        "You verified the extracted information."
      );
    } catch (err) {
      console.error(
        "Verification error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not verify this record."
      );
    } finally {
      setSavingVerification(false);
    }
  }

  async function shareRecord() {
    if (!record || !currentUserId) return;
    const trimmedDoctorId = doctorId.trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(trimmedDoctorId)) {
      setError("Enter a valid doctor account ID (UUID). Your doctor portal team can provide this ID.");
      return;
    }

    if (trimmedDoctorId === currentUserId) {
      setError("You cannot share a record with your own account.");
      return;
    }

    setSharing(true);
    setError("");
    setMessage("");

    try {
      const expiresAt =
        shareDuration === "none"
          ? null
          : new Date(Date.now() + (shareDuration === "24h" ? 24 : 24 * 7) * 60 * 60 * 1000).toISOString();

      const { data, error: shareError } = await supabase
        .from("sharing_permissions")
        .insert({
          health_record_id: record.id,
          patient_id: currentUserId,
          doctor_id: trimmedDoctorId,
          permission: sharePermission,
          status: "active",
          expires_at: expiresAt,
        })
        .select("id,doctor_id,permission,status,expires_at,shared_at")
        .single();

      if (shareError || !data) {
        throw new Error(shareError?.message || "Could not create the share.");
      }

      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          actor_id: currentUserId,
          actor_role: "patient",
          health_record_id: record.id,
          action: "record_shared",
          metadata: { doctor_id: trimmedDoctorId, permission: sharePermission, expires_at: expiresAt },
        });

      if (auditError) console.warn("Share audit entry failed:", auditError.message);

      setShares((current) => [data as typeof shares[number], ...current]);
      setDoctorId("");
      setMessage("Record access was shared with the selected doctor account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share this record.");
    } finally {
      setSharing(false);
    }
  }

  async function revokeShare(shareId: string) {
    setError("");
    setMessage("");

    const { error: revokeError } = await supabase
      .from("sharing_permissions")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", shareId);

    if (revokeError) {
      setError(revokeError.message);
      return;
    }

    setShares((current) => current.map((share) => share.id === shareId ? { ...share, status: "revoked" } : share));
    setMessage("Doctor access was revoked.");
  }

  async function deleteRecord() {
    if (!record) return;

    const confirmed = window.confirm(
      "Delete this health record? This action cannot be undone."
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      /*
       * Record ownership is already enforced by the
       * health_records query/RLS.
       *
       * Remove the private original document first.
       */
      if (
        document?.storage_bucket &&
        document?.storage_path
      ) {
        const { error: storageError } =
          await supabase.storage
            .from(document.storage_bucket)
            .remove([document.storage_path]);

        if (storageError) {
          console.error(
            "Storage deletion error:",
            storageError
          );
        }
      }

      /*
       * Delete the database record.
       *
       * Related records should be removed by the
       * foreign-key cascade configured in the schema.
       */
      const { error: deleteError } =
        await supabase
          .from("health_records")
          .delete()
          .eq("id", record.id);

      if (deleteError) {
        throw deleteError;
      }

      router.replace("/records");
    } catch (err) {
      console.error(
        "Delete record error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not delete this record."
      );
    }
  }

  if (loading) {
    return (
      <div className="app-content">
        <header className="app-header">
          <div className="brand">
            <div className="brand-name">
              Aarogya<span>Vaani</span>
            </div>

            <div className="brand-subtitle">
              Digital Health Locker
            </div>
          </div>
        </header>

        <div className="loading">
          Opening health record…
        </div>

        <BottomNav />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="app-content">
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
          >
            ←
          </Link>
        </header>

        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">
              !
            </div>

            <p className="empty-title">
              Record unavailable
            </p>

            <p className="empty-text">
              {error ||
                "This health record could not be loaded."}
            </p>

            <div style={{ marginTop: 16 }}>
              <Link
                href="/records"
                className="btn btn-primary"
              >
                Back to records
              </Link>
            </div>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  const medicines = Array.isArray(
    record.medicines
  )
    ? record.medicines
    : [];

  const labMetrics = Array.isArray(
    record.lab_metrics
  )
    ? record.lab_metrics
    : [];

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

      {/* Record heading */}
      <section>
        <p className="eyebrow">
          {recordTypeLabels[
            record.record_type
          ] || "Health record"}
        </p>

        <h1 className="page-title">
          {record.title}
        </h1>

        <p className="page-subtitle">
          {formatDate(record.record_date)}
          {record.doctor_name
            ? ` · Dr. ${record.doctor_name}`
            : ""}
        </p>
      </section>

      {/* Verification status */}
      <section
        className="card"
        style={{ marginTop: 16 }}
      >
        <div className="card-padding">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div className="avatar">
              {verified ? "✓" : "!"}
            </div>

            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {verified
                  ? "Information verified by you"
                  : "Review this record"}
              </p>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {verified
                  ? "You confirmed the extracted information against the original document."
                  : "Check the extracted information against the original document before relying on it."}
              </p>
            </div>
          </div>

          {!verified && extraction ? (
            <button
              type="button"
              className="btn btn-primary btn-full"
              style={{ marginTop: 14 }}
              disabled={savingVerification}
              onClick={verifyRecord}
            >
              {savingVerification
                ? "Saving verification…"
                : "I verified this information"}
            </button>
          ) : null}
        </div>
      </section>

      {/* Doctor-ready clinical history */}
      {record.source === "clinical_interview" && (() => {
        const structuredHistory =
          (record.metadata?.structured_history as
            | Record<string, ClinicalHistoryItem[]>
            | undefined) || {};

        const orderedSections = [
          "chief_complaint",
          "hpi",
          "past_history",
          "surgical_history",
          "medications_allergies",
          "family_history",
          "personal_history",
          "review_of_systems",
        ];

        return (
          <section style={{ marginTop: 18 }}>
            <div className="section-heading">
              <h2 className="section-title">Doctor-ready clinical history</h2>
            </div>

            <div className="card">
              <div className="card-padding">
                <div className="clinical-history-note">
                  <strong>Patient-reported history</strong>
                  <span>
                    Structured for quick clinical review. It is not a diagnosis
                    or medical advice.
                  </span>
                </div>

                <div className="clinical-summary-card">
                  <span className="clinical-eyebrow">At a glance</span>
                  <h3>Clinical summary</h3>
                  <p>
                    {buildClinicalSummary(structuredHistory)}
                  </p>
                </div>

                <div className="clinical-history-list">
                  {orderedSections.map((section) => {
                    const items = cleanClinicalItems(
                      structuredHistory[section] || []
                    );

                    if (items.length === 0) return null;

                    return (
                      <section className="clinical-history-section" key={section}>
                        <h3>{clinicalSectionLabel(section)}</h3>

                        <div className="clinical-history-fields">
                          {items.map((item, index) => (
                            <div
                              className="clinical-history-field"
                              key={`${section}-${item.key || item.question}-${index}`}
                            >
                              <span>{clinicalQuestionLabel(item)}</span>
                              <strong>{item.answer}</strong>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>

                {Array.isArray(record.metadata?.red_flags) &&
                  record.metadata.red_flags.length > 0 && (
                    <div className="status status-warning" style={{ marginTop: 14 }}>
                      Some entered symptoms may need prompt medical assessment.
                      A clinician should review the original answers.
                    </div>
                  )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Patient-controlled sharing */}
      <section style={{ marginTop: 18 }}>
        <div className="section-heading">
          <h2 className="section-title">Share with a doctor</h2>
        </div>
        <div className="card">
          <div className="card-padding">
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              You control who can access this record. For this prototype, enter the doctor portal account ID provided by your doctor.
            </p>
            <label className="form-label" htmlFor="doctor-id">Doctor account ID</label>
            <input id="doctor-id" className="form-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" />
            <div className="choice-grid" style={{ marginTop: 12 }}>
              <button type="button" className={`choice-card ${sharePermission === "view" ? "selected" : ""}`} onClick={() => setSharePermission("view")}>View only<br /><span>Doctor can read the record</span></button>
              <button type="button" className={`choice-card ${sharePermission === "download" ? "selected" : ""}`} onClick={() => setSharePermission("download")}>View + download<br /><span>Allows document download when available</span></button>
            </div>
            <label className="form-label" style={{ marginTop: 14 }}>Access duration</label>
            <div className="choice-grid">
              {([
                ["24h", "24 hours"],
                ["7d", "7 days"],
                ["none", "No expiry"],
              ] as const).map(([value, label]) => (
                <button type="button" key={value} className={`choice-card ${shareDuration === value ? "selected" : ""}`} onClick={() => setShareDuration(value)}>{label}</button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-full" style={{ marginTop: 14 }} disabled={sharing || !doctorId.trim()} onClick={shareRecord}>
              {sharing ? "Sharing…" : "Share this record"}
            </button>
            {shares.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <p className="form-label">Access history</p>
                {shares.map((share) => (
                  <div className="history-answer" key={share.id} style={{ marginBottom: 8 }}>
                    <span>Doctor {share.doctor_id.slice(0, 8)}… · {share.permission} · {share.status}</span>
                    <strong>{share.expires_at ? `Expires ${formatDateTime(share.expires_at)}` : "No expiry"}</strong>
                    {share.status === "active" && <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => revokeShare(share.id)}>Revoke</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Original document */}
      <section style={{ marginTop: 18 }}>
        <div className="section-heading">
          <h2 className="section-title">
            Original document
          </h2>
        </div>

        <div className="card">
          <div className="card-padding">
            {document ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div className="avatar">
                    Doc
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        wordBreak: "break-word",
                      }}
                    >
                      {document.original_filename ||
                        "Original document"}
                    </p>

                    <p className="record-meta">
                      {document.mime_type ||
                        "Medical document"}

                      {document.file_size_bytes
                        ? ` · ${formatFileSize(
                            document.file_size_bytes
                          )}`
                        : ""}
                    </p>
                  </div>
                </div>

                {documentUrl ? (
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-full"
                    style={{ marginTop: 14 }}
                  >
                    Inspect original document
                  </a>
                ) : (
                  <div
                    className="disclaimer"
                    style={{
                      marginTop: 14,
                    }}
                  >
                    The original document is stored
                    securely, but a temporary viewing
                    link could not be generated.
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p className="empty-title">
                  Original document unavailable
                </p>

                <p className="empty-text">
                  No original document is linked to
                  this record.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Extracted information */}
      <section style={{ marginTop: 18 }}>
        <div className="section-heading">
          <h2 className="section-title">
            Extracted information
          </h2>
        </div>

        <div className="card">
          <div className="card-padding">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <DetailField
                label="Patient"
                value={
                  record.patient_name ||
                  "Not available"
                }
              />

              <DetailField
                label="Doctor"
                value={
                  record.doctor_name ||
                  "Not available"
                }
              />

              <DetailField
                label="Facility"
                value={
                  record.facility_name ||
                  "Not available"
                }
              />

              <DetailField
                label="Diagnosis"
                value={
                  record.diagnosis ||
                  "Not available"
                }
              />

              <DetailField
                label="Record date"
                value={formatDate(
                  record.record_date
                )}
              />
            </div>

            {medicines.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Medicines
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {medicines.map(
                    (medicine, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 10,
                          border:
                            "1px solid var(--border-light)",
                          borderRadius: 10,
                          background: "#fafcfc",
                          fontSize: 12,
                        }}
                      >
                        {typeof medicine ===
                        "string"
                          ? medicine
                          : JSON.stringify(
                              medicine
                            )}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {labMetrics.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Lab measurements
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {labMetrics.map(
                    (metric, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 10,
                          border:
                            "1px solid var(--border-light)",
                          borderRadius: 10,
                          background: "#fafcfc",
                          fontSize: 12,
                        }}
                      >
                        {typeof metric ===
                        "string"
                          ? metric
                          : JSON.stringify(
                              metric
                            )}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {extraction ? (
              <div style={{ marginTop: 16 }}>
                <span
                  className={`status ${getConfidenceClass(
                    extraction.confidence
                  )}`}
                >
                  {getConfidenceLabel(
                    extraction.confidence
                  )}
                </span>

                {extraction.low_confidence_fields
                  ?.length > 0 ? (
                  <p
                    style={{
                      margin: "7px 0 0",
                      color: "var(--text-muted)",
                      fontSize: 11,
                      lineHeight: 1.5,
                    }}
                  >
                    Some fields may need extra
                    verification.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* AI summary */}
      {record.summary ? (
        <section style={{ marginTop: 18 }}>
          <div className="section-heading">
            <h2 className="section-title">
              AI summary
            </h2>
          </div>

          <div className="card">
            <div className="card-padding">
              <p
                style={{
                  margin: 0,
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {record.summary}
              </p>

              <div className="disclaimer">
                This summary is provided to help
                understand the stored record. It is
                not medical advice and should not
                replace advice from a qualified
                healthcare professional.
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Timeline */}
      <section style={{ marginTop: 18 }}>
        <div className="section-heading">
          <h2 className="section-title">
            Record history
          </h2>
        </div>

        <div className="card">
          <div className="card-padding">
            {timeline.length === 0 ? (
              <div className="empty-state">
                <p className="empty-title">
                  No timeline events
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        flex: "0 0 9px",
                        marginTop: 5,
                        borderRadius: "50%",
                        background:
                          "var(--primary)",
                      }}
                    />

                    <div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {event.title}
                      </p>

                      <p className="record-meta">
                        {formatDateTime(
                          event.event_date
                        )}
                      </p>

                      {event.description ? (
                        <p
                          style={{
                            margin:
                              "4px 0 0",
                            color:
                              "var(--text-secondary)",
                            fontSize: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          {event.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Actions */}
      <section style={{ marginTop: 18 }}>
        <button
          type="button"
          className="btn btn-secondary btn-full"
          onClick={() => {
            if (documentUrl) {
              window.open(
                documentUrl,
                "_blank",
                "noopener,noreferrer"
              );
            }
          }}
          disabled={!documentUrl}
        >
          Open original document
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-full"
          style={{
            marginTop: 8,
            color: "var(--danger)",
          }}
          onClick={deleteRecord}
        >
          Delete record
        </button>
      </section>

      {/* Messages */}
      {message ? (
        <div
          className="status status-success"
          style={{
            marginTop: 14,
            width: "100%",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {message}
        </div>
      ) : null}

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

      <div
        className="disclaimer"
        style={{ marginTop: 14 }}
      >
        Your original document is kept separately
        from the extracted information. Always
        compare important information with the
        original source.
      </div>

      <BottomNav />
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 11,
        border:
          "1px solid var(--border-light)",
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
        {value}
      </div>
    </div>
  );
}