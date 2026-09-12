"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabaseClient";
import type { FamilyMember } from "@/lib/types";

const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी · Hindi" },
  { value: "bn", label: "বাংলা · Bengali" },
  { value: "mr", label: "मराठी · Marathi" },
  { value: "ta", label: "தமிழ் · Tamil" },
  { value: "te", label: "తెలుగు · Telugu" },
];

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const translations = {
  en: {
    account: "Account",
    profileSettings: "Profile & settings",
    profileSubtitle:
      "Manage your profile, family members, language and privacy preferences.",
    fullName: "Full name",
    yourFullName: "Your full name",
    email: "Email",
    preferredLanguage: "Preferred language",
    saveProfile: "Save profile",
    saving: "Saving…",
    familyProfiles: "Family profiles",
    cancel: "Cancel",
    add: "+ Add",
    name: "Name",
    familyMemberName: "Family member's name",
    relationship: "Relationship",
    addFamilyMember: "Add family member",
    adding: "Adding…",
    privacySecurity: "Privacy & security",
    dataControl: "Your health data stays under your control",
    privacyText:
      "Original documents are stored in private health-document storage. Sharing should only happen with your permission.",
    auditText:
      "AarogyaVaani is designed to keep an audit trail of important record actions. AI-generated information should always be checked against the original document.",
    healthConnections: "Health-system connections",
    healthConnectionsText:
      "Doctor sharing, ABDM/ABHA connectivity and hospital integrations can be enabled through authorized healthcare workflows. Do not treat this prototype as a live government health integration.",
    signOut: "Sign out",
  },

  hi: {
    account: "खाता",
    profileSettings: "प्रोफ़ाइल और सेटिंग्स",
    profileSubtitle:
      "अपनी प्रोफ़ाइल, परिवार के सदस्यों, भाषा और गोपनीयता की प्राथमिकताएँ प्रबंधित करें।",
    fullName: "पूरा नाम",
    yourFullName: "अपना पूरा नाम",
    email: "ईमेल",
    preferredLanguage: "पसंदीदा भाषा",
    saveProfile: "प्रोफ़ाइल सेव करें",
    saving: "सेव हो रहा है…",
    familyProfiles: "परिवार की प्रोफ़ाइल",
    cancel: "रद्द करें",
    add: "+ जोड़ें",
    name: "नाम",
    familyMemberName: "परिवार के सदस्य का नाम",
    relationship: "रिश्ता",
    addFamilyMember: "परिवार का सदस्य जोड़ें",
    adding: "जोड़ा जा रहा है…",
    privacySecurity: "गोपनीयता और सुरक्षा",
    dataControl: "आपका स्वास्थ्य डेटा आपके नियंत्रण में है",
    privacyText:
      "मूल दस्तावेज़ निजी स्वास्थ्य-दस्तावेज़ स्टोरेज में सुरक्षित रखे जाते हैं। शेयरिंग केवल आपकी अनुमति से होनी चाहिए।",
    auditText:
      "AarogyaVaani महत्वपूर्ण रिकॉर्ड गतिविधियों का ऑडिट ट्रेल रखने के लिए बनाया गया है। AI द्वारा बनाई गई जानकारी को हमेशा मूल दस्तावेज़ से जाँचें।",
    healthConnections: "स्वास्थ्य-प्रणाली कनेक्शन",
    healthConnectionsText:
      "डॉक्टर शेयरिंग, ABDM/ABHA कनेक्टिविटी और अस्पताल एकीकरण अधिकृत स्वास्थ्य सेवाओं के माध्यम से सक्षम किए जा सकते हैं। इस प्रोटोटाइप को लाइव सरकारी स्वास्थ्य एकीकरण न मानें।",
    signOut: "साइन आउट",
  },
};

export default function SettingsPage() {
  const router = useRouter();
const supabase = createClient();
const { language: appLanguage, setLanguage: setAppLanguage } =
  useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [language, setLanguage] = useState("en");

  const [familyMembers, setFamilyMembers] = useState<
    FamilyMember[]
  >([]);

  const [showAddFamily, setShowAddFamily] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [relationship, setRelationship] = useState("mother");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const t =
  appLanguage === "hi-IN"
    ? translations.hi
    : translations.en;
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "";

        if (!mounted) return;

        setUserId(user.id);
        setName(displayName);
        setEmail(user.email || "");

        const storedLanguage =
          user.user_metadata?.preferred_language;

        if (
          typeof storedLanguage === "string" &&
          languages.some(
            (item) => item.value === storedLanguage
          )
        ) {
          setLanguage(storedLanguage);
        }

        const { data: members, error: familyError } =
          await supabase
            .from("family_members")
            .select("*")
            .eq("owner_id", user.id)
            .order("is_self", {
              ascending: false,
            })
            .order("created_at", {
              ascending: true,
            });

        if (familyError) {
          console.error(
            "Family members error:",
            familyError
          );
        }

        if (!mounted) return;

        setFamilyMembers(
          (members ?? []) as FamilyMember[]
        );
      } catch (err) {
        console.error(
          "Settings loading error:",
          err
        );

        if (mounted) {
          setError(
            "Could not load your profile."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    if (!userId) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          data: {
            full_name: trimmedName,
            preferred_language: language,
          },
        });

      if (updateError) {
        throw updateError;
      }

      /*
       * Keep the primary family profile name
       * synchronized with the account name.
       */
      const { error: familyError } =
        await supabase
          .from("family_members")
          .update({
            name: trimmedName,
          })
          .eq("owner_id", userId)
          .eq("is_self", true);

      if (familyError) {
        console.error(
          "Primary family profile update error:",
          familyError
        );
      }

      setMessage("Profile saved.");
    } catch (err) {
      console.error(
        "Profile save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addFamilyMember(
    event: FormEvent
  ) {
    event.preventDefault();

    const trimmedName = familyName.trim();

    if (!trimmedName) {
      setError(
        "Please enter the family member's name."
      );
      return;
    }

    if (!userId) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { data: member, error: insertError } =
        await supabase
          .from("family_members")
          .insert({
            owner_id: userId,
            name: trimmedName,
            relationship,
            is_self: false,
          })
          .select("*")
          .single();

      if (insertError || !member) {
        throw new Error(
          insertError?.message ||
            "Could not add family member."
        );
      }

      setFamilyMembers((current) => [
        ...current,
        member as FamilyMember,
      ]);

      setFamilyName("");
      setRelationship("mother");
      setShowAddFamily(false);
      setMessage(
        `${trimmedName} was added to your family profiles.`
      );
    } catch (err) {
      console.error(
        "Add family member error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not add family member."
      );
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setError("");

    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    router.replace("/login");
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
          Loading your profile…
        </div>

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
          href="/dashboard"
          className="profile-button"
          aria-label="Back to home"
        >
          ←
        </Link>
      </header>

      {/* Page heading */}
      <section>
        <p className="eyebrow">{t.account}</p>

<h1 className="page-title">
  {t.profileSettings}
</h1>

<p className="page-subtitle">
  {t.profileSubtitle}
</p>
      </section>

      {/* Profile card */}
      <section
        className="card"
        style={{ marginTop: 18 }}
      >
        <div className="card-padding">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              className="avatar"
              style={{
                width: 52,
                height: 52,
                flexBasis: 52,
                fontSize: 17,
              }}
            >
              {getInitials(name) || "U"}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {name || "Your profile"}
              </div>

              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {email}
              </div>
            </div>
          </div>

          <form onSubmit={saveProfile}>
  <div className="form-group">
    <label
      className="form-label"
      htmlFor="profile-name"
    >
      {t.fullName}
    </label>

    <input
      id="profile-name"
      className="form-input"
      value={name}
      onChange={(event) => setName(event.target.value)}
      placeholder={t.yourFullName}
    />
  </div>

  <div className="form-group">
    <label
      className="form-label"
      htmlFor="profile-email"
    >
      {t.email}
    </label>

    <input
      id="profile-email"
      className="form-input"
      value={email}
      disabled
    />
  </div>

  <div className="form-group">
    <label
      className="form-label"
      htmlFor="language"
    >
      {t.preferredLanguage}
    </label>

    <select
      id="language"
      className="form-select"
      value={language}
      onChange={(event) => {
        const nextLanguage = event.target.value;
        setLanguage(nextLanguage);

        if (nextLanguage === "hi") {
          setAppLanguage("hi-IN");
        } else {
          setAppLanguage("en-IN");
        }
      }}
    >
      {languages.map((item) => (
        <option
          key={item.value}
          value={item.value}
        >
          {item.label}
        </option>
      ))}
    </select>
  </div>

  <button
    type="submit"
    className="btn btn-primary btn-full"
    disabled={saving}
  >
    {saving ? t.saving : t.saveProfile}
  </button>
</form>
        </div>
      </section>

      {/* Family profiles */}
      <section style={{ marginTop: 22 }}>
        <div className="section-heading">
          <h2 className="section-title">
  {t.familyProfiles}
</h2>

          <button
            type="button"
            className="section-link"
            onClick={() =>
              setShowAddFamily((current) => !current)
            }
          >
            {showAddFamily ? t.cancel : t.add}
          </button>
        </div>

        <div className="record-list">
          {familyMembers.map((member) => (
            <div
              className="card family-card"
              key={member.id}
            >
              <div className="avatar">
                {getInitials(member.name) || "U"}
              </div>

              <div className="family-info">
                <p className="family-name">
                  {member.name}
                </p>

                <p className="family-meta">
                  {member.is_self
                    ? "Self · Primary profile"
                    : member.relationship ||
                      "Family member"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Add family member */}
        {showAddFamily ? (
          <div
            className="card"
            style={{ marginTop: 10 }}
          >
            <div className="card-padding">
              <form onSubmit={addFamilyMember}>
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="family-name"
                  >
                    {t.name}
                  </label>

                  <input
                    id="family-name"
                    className="form-input"
                    value={familyName}
                    onChange={(event) =>
                      setFamilyName(
                        event.target.value
                      )
                    }
                    placeholder={t.familyMemberName}
                  />
                </div>

                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="relationship"
                  >
                    {t.relationship}
                  </label>

                  <select
                    id="relationship"
                    className="form-select"
                    value={relationship}
                    onChange={(event) =>
                      setRelationship(
                        event.target.value
                      )
                    }
                  >
                    <option value="mother">
                      Mother
                    </option>

                    <option value="father">
                      Father
                    </option>

                    <option value="sister">
                      Sister
                    </option>

                    <option value="brother">
                      Brother
                    </option>

                    <option value="spouse">
                      Spouse
                    </option>

                    <option value="child">
                      Child
                    </option>

                    <option value="grandparent">
                      Grandparent
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={saving}
                >
                  {saving
  ? t.adding
  : t.addFamilyMember}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>

      {/* Privacy */}
      <section style={{ marginTop: 22 }}>
        <div className="section-heading">
          <h2 className="section-title">
            Privacy & security
          </h2>
        </div>

        <div className="card">
          <div className="card-padding">
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div className="avatar">
                ✓
              </div>

              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Your health data stays under
                  your control
                </p>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Original documents are stored in
                  private health-document storage.
                  Sharing should only happen with
                  your permission.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop:
                  "1px solid var(--border-light)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                AarogyaVaani is designed to keep an
                audit trail of important record
                actions. AI-generated information
                should always be checked against
                the original document.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo / integration note */}
      <section
        className="card"
        style={{ marginTop: 12 }}
      >
        <div className="card-padding">
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Health-system connections
          </p>

          <p
            style={{
              margin: "5px 0 0",
              color: "var(--text-secondary)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Doctor sharing, ABDM/ABHA connectivity
            and hospital integrations can be
            enabled through authorized healthcare
            workflows. Do not treat this prototype
            as a live government health integration.
          </p>
        </div>
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

      {/* Sign out */}
      <button
        type="button"
        className="btn btn-secondary btn-full"
        style={{
          marginTop: 18,
          color: "var(--danger)",
        }}
        onClick={signOut}
      >
        Sign out
      </button>

      <div
        style={{
          height: 8,
        }}
      />

      <BottomNav />
    </div>
  );
}