"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import type { FamilyMember, HealthRecord } from "@/lib/types";
import BottomNav from "@/components/BottomNav";

const recordTypeLabels: Record<string, string> = {
  prescription: "Prescriptions",
  lab_report: "Lab reports",
  doctor_visit: "Doctor visits",
  diagnosis: "Diagnoses",
  imaging: "Imaging",
  vaccination: "Vaccinations",
  discharge_summary: "Discharge summaries",
  other: "Other records",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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

export default function DashboardPage() {
  const router = useRouter();
    const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("there");
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [records, setRecords] = useState<HealthRecord[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "there";

        if (!mounted) return;

        setDisplayName(name);

        const { data: existingMembers, error: familyError } =
          await supabase
            .from("family_members")
            .select("*")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true });

        if (familyError) {
          console.error("Family members error:", familyError);
        }

        let members = (existingMembers ?? []) as FamilyMember[];

        /*
         * Every account should have a primary "self" family profile.
         * If one does not exist yet, create it.
         */
        if (members.length === 0) {
          const { data: createdMember, error: createError } =
            await supabase
              .from("family_members")
              .insert({
                owner_id: user.id,
                name,
                relationship: "self",
                is_self: true,
              })
              .select("*")
              .single();

          if (createError) {
            console.error("Create family member error:", createError);
          } else if (createdMember) {
            members = [createdMember as FamilyMember];
          }
        }

        if (!mounted) return;

        setFamilyMembers(members);

        const memberIds = members.map((member) => member.id);

        if (memberIds.length === 0) {
          setRecords([]);
          return;
        }

        const { data: healthRecords, error: recordsError } = await supabase
          .from("health_records")
          .select("*")
          .in("family_member_id", memberIds)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recordsError) {
          console.error("Health records error:", recordsError);
        }

        if (!mounted) return;

        setRecords((healthRecords ?? []) as HealthRecord[]);
      } catch (error) {
        console.error("Dashboard loading error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  const stats = useMemo(() => {
    const countByType = (type: string) =>
      records.filter((record) => record.record_type === type).length;

    return {
      total: records.length,
      prescriptions: countByType("prescription"),
      labReports: countByType("lab_report"),
      family: familyMembers.length,
    };
  }, [records, familyMembers]);

  if (loading) {
    return (
      <div className="app-content">
        <div className="loading">Loading your health locker…</div>
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
          <div className="brand-subtitle">Digital Health Locker</div>
        </div>

        <Link
          href="/settings"
          className="profile-button"
          aria-label="Open profile"
        >
          {getInitials(displayName) || "U"}
        </Link>
      </header>

      {/* Welcome */}
      <section className="welcome-card">
        <p className="eyebrow">Your health records</p>

        <h1 className="welcome-title">
          Welcome back,
          <br />
          {displayName}
        </h1>

        <p className="welcome-text">
          Store your records securely, understand your health history, and
          share the right information when you need it.
        </p>

        <div className="button-row">
          <Link href="/scan" className="btn btn-primary">
            + Add record
          </Link>

          <Link href="/scan" className="btn btn-secondary">
            Scan document
          </Link>

          <Link href="/history" className="btn btn-secondary">
            Start health history
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section style={{ marginTop: 22 }}>
        <div className="section-heading">
          <h2 className="section-title">Your locker</h2>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Recent records</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats.family}</div>
            <div className="stat-label">Family profiles</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats.prescriptions}</div>
            <div className="stat-label">Prescriptions</div>
          </div>

          <div className="stat-card">
            <div className="stat-number">{stats.labReports}</div>
            <div className="stat-label">Lab reports</div>
          </div>
        </div>
      </section>

      {/* Family */}
      <section style={{ marginTop: 24 }}>
        <div className="section-heading">
          <h2 className="section-title">Family profiles</h2>

          <Link href="/settings" className="section-link">
            Manage
          </Link>
        </div>

        <div className="record-list">
          {familyMembers.map((member) => (
            <div className="card family-card" key={member.id}>
              <div className="avatar">
                {getInitials(member.name) || "U"}
              </div>

              <div className="family-info">
                <p className="family-name">{member.name}</p>

                <p className="family-meta">
                  {member.is_self
                    ? "Self · Primary profile"
                    : member.relationship || "Family member"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section style={{ marginTop: 24 }}>
        <div className="section-heading">
          <h2 className="section-title">Recent activity</h2>

          <Link href="/records" className="section-link">
            View all
          </Link>
        </div>

        <div className="card activity-card">
          {records.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">+</div>

              <p className="empty-title">No records yet</p>

              <p className="empty-text">
                Add your first prescription, lab report, or medical document
                to start building your health timeline.
              </p>

              <div style={{ marginTop: 16 }}>
                <Link href="/scan" className="btn btn-primary">
                  Add your first record
                </Link>
              </div>
            </div>
          ) : (
            <div className="record-list">
              {records.slice(0, 5).map((record) => (
                <Link
                  href={`/records/${record.id}`}
                  className="record-card"
                  key={record.id}
                >
                  <div className="record-card-top">
                    <div className="avatar">
                      {record.record_type === "prescription"
                        ? "Rx"
                        : record.record_type === "lab_report"
                          ? "Lab"
                          : "Doc"}
                    </div>

                    <div className="record-card-content">
                      <p className="record-title">
                        {record.title ||
                          recordTypeLabels[record.record_type] ||
                          "Health record"}
                      </p>

                      <p className="record-meta">
                        {formatDate(record.record_date)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Privacy notice */}
      <div className="disclaimer">
        <strong>Your data, your control.</strong> AarogyaVaani is designed so
        you can review your records before saving or sharing them. AI-generated
        information should always be verified against the original document
        and is not medical advice.
      </div>

      <BottomNav />
    </div>
  );
}