"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import type { FamilyMember, HealthRecord, RecordType } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

const recordTypes: { value: "all" | RecordType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "prescription", label: "Prescriptions" },
  { value: "lab_report", label: "Lab reports" },
  { value: "doctor_visit", label: "Visits" },
  { value: "diagnosis", label: "Diagnoses" },
  { value: "imaging", label: "Imaging" },
  { value: "vaccination", label: "Vaccines" },
  { value: "discharge_summary", label: "Discharge" },
];

const recordTypeLabels: Record<string, string> = {
  prescription: "Prescription",
  lab_report: "Lab report",
  doctor_visit: "Doctor visit",
  diagnosis: "Diagnosis",
  imaging: "Imaging",
  vaccination: "Vaccination",
  discharge_summary: "Discharge summary",
  other: "Other",
};

function formatDate(date: string | null | undefined) {
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

function getRecordIcon(type: string) {
  switch (type) {
    case "prescription":
      return "Rx";
    case "lab_report":
      return "Lab";
    case "doctor_visit":
      return "Visit";
    case "diagnosis":
      return "Dx";
    case "imaging":
      return "Img";
    case "vaccination":
      return "Vax";
    default:
      return "Doc";
  }
}

export default function RecordsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | RecordType>(
    "all"
  );

  useEffect(() => {
    let mounted = true;

    async function loadRecords() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: members, error: membersError } =
          await supabase
            .from("family_members")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true });

        if (membersError) {
          console.error("Family members error:", membersError);
        }

        const typedMembers = (members ?? []) as FamilyMember[];

        if (!mounted) return;

        setFamilyMembers(typedMembers);

        const memberIds = typedMembers.map((member) => member.id);

        if (memberIds.length === 0) {
          setRecords([]);
          return;
        }

        const { data: healthRecords, error: recordsError } = await supabase
          .from("health_records")
          .select("*")
          .in("family_member_id", memberIds)
          .order("record_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (recordsError) {
          console.error("Health records error:", recordsError);
        }

        if (!mounted) return;

        setRecords((healthRecords ?? []) as HealthRecord[]);
      } catch (error) {
        console.error("Records loading error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => {
      mounted = false;
    };
  }, [router]);

  const memberNameById = useMemo(() => {
    const map: Record<string, string> = {};

    familyMembers.forEach((member) => {
      map[member.id] = member.name;
    });

    return map;
  }, [familyMembers]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesType =
        selectedType === "all" || record.record_type === selectedType;

      if (!matchesType) return false;

      if (!query) return true;

      const searchableText = [
        record.title,
        record.doctor_name,
        record.facility_name,
        record.diagnosis,
        record.summary,
        recordTypeLabels[record.record_type],
        record.family_member_id
          ? memberNameById[record.family_member_id]
          : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [records, search, selectedType, memberNameById]);

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

        <div className="loading">Loading your records…</div>

        <BottomNav />
      </div>
    );
  }

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
          href="/settings"
          className="profile-button"
          aria-label="Open profile"
        >
          P
        </Link>
      </header>

      {/* Page heading */}
      <section>
        <p className="eyebrow">Your locker</p>

        <h1 className="page-title">Health records</h1>

        <p className="page-subtitle">
          Keep your prescriptions, reports, visits and other health documents
          together.
        </p>
      </section>

      {/* Add record */}
      <div style={{ marginTop: 16 }}>
        <Link href="/scan" className="btn btn-primary btn-full">
          + Add health record
        </Link>
      </div>

      {/* Search */}
      <div style={{ marginTop: 14 }}>
        <input
          className="search-box"
          type="search"
          placeholder="Search records, doctors, diagnoses…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search health records"
        />
      </div>

      {/* Filters */}
      <div className="filter-row">
        {recordTypes.map((type) => (
          <button
            key={type.value}
            type="button"
            className={`filter-chip ${
              selectedType === type.value ? "active" : ""
            }`}
            onClick={() => setSelectedType(type.value)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {filteredRecords.length}{" "}
          {filteredRecords.length === 1 ? "record" : "records"}
        </span>

        {search || selectedType !== "all" ? (
          <button
            type="button"
            className="section-link"
            onClick={() => {
              setSearch("");
              setSelectedType("all");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">+</div>

            <p className="empty-title">
              {records.length === 0
                ? "Your health locker is empty"
                : "No matching records"}
            </p>

            <p className="empty-text">
              {records.length === 0
                ? "Scan a prescription, lab report or medical document to add it to your locker."
                : "Try a different search term or record category."}
            </p>

            {records.length === 0 ? (
              <div style={{ marginTop: 16 }}>
                <Link href="/scan" className="btn btn-primary">
                  Scan your first document
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="record-list">
          {filteredRecords.map((record) => (
            <Link
              key={record.id}
              href={`/records/${record.id}`}
              className="record-card"
            >
              <div className="record-card-top">
                <div className="avatar">
                  {getRecordIcon(record.record_type)}
                </div>

                <div className="record-card-content">
                  <p className="record-title">
                    {record.title ||
                      recordTypeLabels[record.record_type] ||
                      "Health record"}
                  </p>

                  <p className="record-meta">
                    {recordTypeLabels[record.record_type] ||
                      "Health record"}{" "}
                    · {formatDate(record.record_date)}
                  </p>

                  {record.doctor_name ? (
                    <p className="record-meta">
                      Dr. {record.doctor_name}
                    </p>
                  ) : null}

                  {record.family_member_id &&
                  memberNameById[record.family_member_id] ? (
                    <p className="record-meta">
                      For {memberNameById[record.family_member_id]}
                    </p>
                  ) : null}
                </div>

                <span
                  aria-hidden="true"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  ›
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Verification notice */}
      <div className="disclaimer">
        <strong>Verify before relying on extracted information.</strong>{" "}
        AarogyaVaani keeps the original document alongside extracted data so
        you can check important details against the source. AI summaries are
        for record understanding and are not medical advice.
      </div>

      <BottomNav />
    </div>
  );
}