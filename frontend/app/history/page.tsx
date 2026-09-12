"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createClient } from "@/lib/supabaseClient";
import type { FamilyMember } from "@/lib/types";

type SectionKey =
  | "chief_complaint"
  | "hpi"
  | "past_history"
  | "surgical_history"
  | "medications_allergies"
  | "family_history"
  | "personal_history"
  | "review_of_systems";

type Answer = {
  key: string;
  section: SectionKey;
  question: string;
  answer: string;
  source: "voice" | "typed" | "touch";
};

type MedicineOption = {
  name: string;
  composition?: string;
};

type Question = {
  key: string;
  section: SectionKey;
  question: string;
  hint?: string;
  options?: string[];
};

const sectionOrder: SectionKey[] = [
  "chief_complaint",
  "hpi",
  "past_history",
  "surgical_history",
  "medications_allergies",
  "family_history",
  "personal_history",
  "review_of_systems",
];

const sectionLabels: Record<SectionKey, string> = {
  chief_complaint: "Chief complaint",
  hpi: "History of Present Illness (HPI)",
  past_history: "Past medical history",
  surgical_history: "Surgical history",
  medications_allergies: "Medicines & allergies",
  family_history: "Family history",
  personal_history: "Personal / social history",
  review_of_systems: "Review of Systems",
};

function questionFor(section: SectionKey, answers: Answer[]): Question {
  if (section === "chief_complaint") {
    return {
      key: "chief_complaint",
      section,
      question: "What is bothering you today?",
      hint: "You can type it or use the microphone. There is no need to use medical words.",
    };
  }

  if (section === "hpi") {
    const complaint =
      answers.find((a) => a.key === "chief_complaint")?.answer ||
      "this problem";

    const lower = complaint.toLowerCase();

    if (/pain|ache|hurt|दर्द|पीड़ा/.test(lower)) {
      if (!answers.some((a) => a.key === "pain_location")) {
        return {
          key: "pain_location",
          section,
          question: "Where do you feel the pain?",
          options: [
            "Head",
            "Chest",
            "Stomach",
            "Back",
            "Joint or limb",
            "Other",
          ],
        };
      }

      if (!answers.some((a) => a.key === "pain_onset")) {
        return {
          key: "pain_onset",
          section,
          question: "When did it start?",
          options: [
            "Today",
            "Within a few days",
            "Within a few weeks",
            "More than a month ago",
            "I am not sure",
          ],
        };
      }

      if (!answers.some((a) => a.key === "pain_severity")) {
        return {
          key: "pain_severity",
          section,
          question: "How severe is it right now?",
          options: ["Mild", "Moderate", "Severe", "Not sure"],
        };
      }
    }

    if (
      /fever|बुखार/.test(lower) &&
      !answers.some((a) => a.key === "fever_duration")
    ) {
      return {
        key: "fever_duration",
        section,
        question: "How long have you had the fever?",
        options: [
          "Less than a day",
          "1–3 days",
          "4–7 days",
          "More than a week",
          "Not sure",
        ],
      };
    }

    /*
     * Pain already has its own onset question, so do not ask
     * the generic onset question again.
     */
    if (
      !/pain|ache|hurt|दर्द|पीड़ा/.test(lower) &&
      !answers.some((a) => a.key === "problem_onset")
    ) {
      return {
        key: "problem_onset",
        section,
        question: "When did this problem begin?",
        options: [
          "Today",
          "Within a few days",
          "Within a few weeks",
          "More than a month ago",
          "Not sure",
        ],
      };
    }

    if (!answers.some((a) => a.key === "problem_course")) {
      return {
        key: "problem_course",
        section,
        question:
          "Since it started, has it been getting better, worse, or staying about the same?",
        options: [
          "Getting better",
          "Getting worse",
          "About the same",
          "Comes and goes",
          "Not sure",
        ],
      };
    }

    if (!answers.some((a) => a.key === "associated_symptoms")) {
      return {
        key: "associated_symptoms",
        section,
        question: "Are there any other symptoms you have noticed?",
        hint:
          "For example: nausea, cough, weakness, dizziness, changes in appetite, or anything else.",
      };
    }

    return {
      key: "hpi_complete",
      section,
      question:
        "Is there anything else about this problem that you want the doctor to know?",
    };
  }

  if (section === "medications_allergies") {
    const medicineAnswer = answers.find(
      (a) => a.key === "regular_medicines"
    )?.answer;

    if (!medicineAnswer) {
      return {
        key: "regular_medicines",
        section,
        question: "Do you currently take any regular medicines?",
        options: ["No", "Yes", "Not sure"],
      };
    }

    if (
      /^yes$/i.test(medicineAnswer.trim()) &&
      !answers.some((a) => a.key === "medicine_names")
    ) {
      return {
        key: "medicine_names",
        section,
        question: "Which regular medicines do you take?",
        hint:
          "Start typing a medicine name and choose it from the list. You can also enter the name manually if it is not listed.",
      };
    }

    if (!answers.some((a) => a.key === "medicine_allergies")) {
      return {
        key: "medicine_allergies",
        section,
        question: "Do you have any medicine or drug allergies?",
        options: ["No", "Yes", "Not sure"],
      };
    }

    if (
      /^yes$/i.test(
        answers
          .find((a) => a.key === "medicine_allergies")
          ?.answer?.trim() || ""
      ) &&
      !answers.some((a) => a.key === "allergy_details")
    ) {
      return {
        key: "allergy_details",
        section,
        question: "Which medicine or drug causes the allergy?",
        hint:
          "Enter the name if you know it. Do not worry if you are unsure.",
      };
    }

    return {
      key: "medications_complete",
      section,
      question:
        "Is there anything else about your medicines or allergies that the doctor should know?",
    };
  }

  const defaults: Record<
    Exclude<
      SectionKey,
      "chief_complaint" | "hpi" | "medications_allergies"
    >,
    Question
  > = {
    past_history: {
      key: "past_conditions",
      section,
      question:
        "Have you ever been told by a doctor that you have a long-term medical condition?",
      options: ["No", "Yes", "Not sure"],
    },

    surgical_history: {
      key: "surgeries",
      section,
      question: "Have you ever had an operation or surgery?",
      options: ["No", "Yes", "Not sure"],
    },

    family_history: {
      key: "family_conditions",
      section,
      question:
        "Does anyone in your close family have an important medical condition that the doctor should know about?",
      options: ["No", "Yes", "Not sure"],
    },

    personal_history: {
      key: "daily_habits",
      section,
      question:
        "Is there anything about your daily habits, sleep, food, or activity that the doctor should know?",
      options: ["No", "Yes", "Not sure"],
    },

    review_of_systems: {
      key: "other_symptoms",
      section,
      question:
        "Apart from what we have discussed, do you have any other symptoms you want to mention?",
      options: ["No", "Yes"],
    },
  };

  return defaults[
    section as Exclude<
      SectionKey,
      "chief_complaint" | "hpi" | "medications_allergies"
    >
  ];
}

function hasUrgentFlag(answers: Answer[]) {
  const text = answers.map((a) => a.answer.toLowerCase()).join(" ");

  return /chest pain|difficulty breathing|trouble breathing|shortness of breath|fainted|passed out|sudden weakness|severe bleeding|confusion|बेहोश|सांस लेने में दिक्कत|सीने में दर्द/.test(
    text
  );
}

function buildStructuredHistory(answers: Answer[]) {
  const bySection = Object.fromEntries(
    sectionOrder.map((section) => [section, [] as Answer[]])
  ) as Record<SectionKey, Answer[]>;

  for (const answer of answers) {
    bySection[answer.section].push(answer);
  }

  return Object.fromEntries(
    sectionOrder.map((section) => [
      section,
      bySection[section].map((answer) => ({
        key: answer.key,
        question: answer.question,
        answer: answer.answer,
        source: answer.source,
      })),
    ])
  );
}

function buildSummary(answers: Answer[]) {
  const complaint = answers.find(
    (answer) => answer.key === "chief_complaint"
  )?.answer?.trim();

  if (!complaint) {
    return "No chief complaint recorded.";
  }

  const hpi = answers
    .filter(
      (answer) =>
        answer.section === "hpi" &&
        answer.key !== "hpi_complete" &&
        answer.answer.trim()
    )
    .map((answer) => answer.answer.trim());

  const parts = [
    `Patient reports ${complaint.toLowerCase()}.`,
    hpi.length > 0
      ? `History of Present Illness: ${hpi.join("; ")}.`
      : "",
    "This is patient-reported information and is not a diagnosis.",
  ].filter(Boolean);

  return parts.join(" ");
}

export default function ClinicalHistoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [familyMember, setFamilyMember] =
    useState<FamilyMember | null>(null);

  const [language, setLanguage] =
    useState<"en-IN" | "hi-IN">("en-IN");

  const [mode, setMode] =
    useState<"voice" | "touch" | "mixed">("mixed");

  const [started, setStarted] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState("");
  const [interviewId, setInterviewId] =
    useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] =
    useState(false);

  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const [medicineSuggestions, setMedicineSuggestions] =
    useState<MedicineOption[]>([]);

  const [selectedMedicines, setSelectedMedicines] =
    useState<MedicineOption[]>([]);

  const [medicineLoading, setMedicineLoading] =
    useState(false);

  const medicineCache = useMemo(
    () => new Map<string, MedicineOption[]>(),
    []
  );

  /*
   * Keep a valid section/question even while the Review screen
   * is rendered. This prevents hooks from ever evaluating
   * undefined.key and keeps the Question type non-nullable.
   */
  const currentSection =
    sectionOrder[sectionIndex] ??
    sectionOrder[sectionOrder.length - 1];

  const currentQuestion = useMemo(
    () => questionFor(currentSection, answers),
    [currentSection, answers]
  );

  const progress = Math.round(
    (Math.min(sectionIndex + 1, sectionOrder.length) /
      sectionOrder.length) *
      100
  );

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window ||
          "webkitSpeechRecognition" in window)
    );
  }, []);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      let { data: member } = await supabase
        .from("family_members")
        .select("*")
        .eq("owner_id", user.id)
        .eq("is_self", true)
        .maybeSingle();

      if (!member) {
        const { data: created } = await supabase
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
          .select("*")
          .single();

        member = created;
      }

      setFamilyMember(member as FamilyMember | null);
    }

    load();
  }, [router]);

  function speakQuestion() {
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis ||
      !currentQuestion
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      currentQuestion.question
    );

    utterance.lang = language;

    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    if (!speechSupported) return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError(
        "Voice input is not available in this browser. You can continue by typing."
      );
      return;
    }

    const recognition = new SpeechRecognitionCtor();

    recognition.lang = language;
    recognition.interimResults = false;
    recognition.continuous = false;

    setError("");
    setListening(true);

    recognition.onresult = (event: any) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript || "";

      setDraft((prev) =>
        `${prev}${prev ? " " : ""}${transcript}`.trim()
      );

      setMode("voice");
    };

    recognition.onerror = () => {
      setError(
        "Voice input could not be captured. You can continue by typing or tapping an answer."
      );
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError(
        "Voice input could not be started. You can continue by typing."
      );
    }
  }

  /*
   * Restore selected medicines when entering/editing the
   * medicine question.
   *
   * Stored format:
   * ["Medicine A", "Medicine B"]
   */
  useEffect(() => {
    if (currentQuestion?.key !== "medicine_names") {
      setMedicineSuggestions([]);
      setMedicineLoading(false);
      return;
    }

    const existing = answers.find(
      (a) => a.key === "medicine_names"
    )?.answer;

    if (!existing) {
      setSelectedMedicines([]);
      return;
    }

    try {
      const parsed = JSON.parse(existing);

      if (Array.isArray(parsed)) {
        const restored: MedicineOption[] = parsed
          .filter(
            (item) =>
              typeof item === "string" &&
              item.trim().length > 0
          )
          .map((name) => ({
            name: name.trim(),
          }));

        setSelectedMedicines(restored);
        return;
      }
    } catch {
      /*
       * Backward compatibility for an older free-text
       * medicine answer.
       */
    }

    setSelectedMedicines([
      {
        name: existing.trim(),
      },
    ]);
  }, [currentQuestion?.key, answers]);

  /*
   * Medicine autocomplete.
   *
   * The local catalogue is split into a-z JSON files.
   * Only the required letter is loaded.
   */
  useEffect(() => {
    if (currentQuestion?.key !== "medicine_names") {
      setMedicineSuggestions([]);
      setMedicineLoading(false);
      return;
    }

    const normalized = draft
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (normalized.length < 2) {
      setMedicineSuggestions([]);
      setMedicineLoading(false);
      return;
    }

    const prefix = normalized[0];

    let cancelled = false;

    async function loadMedicineNames() {
      setMedicineLoading(true);

      try {
        let medicines = medicineCache.get(prefix);

        if (!medicines) {
          const response = await fetch(
            `/data/medicines/${prefix}.json`
          );

          if (!response.ok) {
            throw new Error("Could not load medicine catalogue.");
          }

          medicines =
            (await response.json()) as MedicineOption[];

          medicineCache.set(prefix, medicines || []);
        }

        if (cancelled) return;

        const selected = new Set(
          selectedMedicines.map((medicine) =>
            medicine.name.toLowerCase()
          )
        );

        const matches = (medicines || [])
          .filter(
            (medicine) =>
              medicine &&
              typeof medicine.name === "string" &&
              !selected.has(
                medicine.name.toLowerCase()
              )
          )
          .filter((medicine) => {
            const name = medicine.name
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");

            return name.includes(normalized);
          })
          .sort((a, b) => {
            const aName = a.name
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");

            const bName = b.name
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");

            const aStarts = aName.startsWith(normalized);
            const bStarts = bName.startsWith(normalized);

            if (aStarts !== bStarts) {
              return aStarts ? -1 : 1;
            }

            return a.name.localeCompare(b.name);
          })
          .slice(0, 8);

        setMedicineSuggestions(matches);
      } catch {
        if (!cancelled) {
          setMedicineSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setMedicineLoading(false);
        }
      }
    }

    const timer = window.setTimeout(
      loadMedicineNames,
      120
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    currentQuestion?.key,
    draft,
    medicineCache,
    selectedMedicines,
  ]);

  function addMedicine(medicine: MedicineOption) {
    const cleanName = medicine.name.trim();

    if (!cleanName) return;

    setSelectedMedicines((current) => {
      const exists = current.some(
        (item) =>
          item.name.toLowerCase() ===
          cleanName.toLowerCase()
      );

      if (exists) return current;

      return [
        ...current,
        {
          name: cleanName,
          composition: medicine.composition,
        },
      ];
    });

    setDraft("");
    setMedicineSuggestions([]);
    setError("");
  }

  function removeMedicine(name: string) {
    setSelectedMedicines((current) =>
      current.filter(
        (medicine) =>
          medicine.name.toLowerCase() !==
          name.toLowerCase()
      )
    );
  }

  function medicineAnswerValue() {
    const medicines = selectedMedicines
      .map((medicine) => medicine.name.trim())
      .filter(Boolean);

    return JSON.stringify(medicines);
  }

  async function createInterview() {
    if (!userId || !familyMember) {
      return false;
    }

    const { data, error: createError } =
      await supabase
        .from("clinical_interviews")
        .insert({
          family_member_id: familyMember.id,
          created_by: userId,
          language,
          input_mode: mode,
          status: "draft",
          current_section: currentSection,
        })
        .select("id")
        .single();

    if (createError || !data) {
      setError(
        createError?.message ||
          "Could not start the health interview."
      );

      return false;
    }

    setInterviewId(data.id);

    return true;
  }

  async function persistAnswer(
    answer: Answer,
    isEdit = false
  ) {
    if (!interviewId) return;

    /*
     * When editing an answer, replace the previous database
     * row instead of creating duplicates.
     */
    if (isEdit) {
      const { error: deleteError } =
        await supabase
          .from("clinical_interview_answers")
          .delete()
          .eq("interview_id", interviewId)
          .eq("question_key", answer.key);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    const { error: answerError } =
      await supabase
        .from("clinical_interview_answers")
        .insert({
          interview_id: interviewId,
          section: answer.section,
          question_key: answer.key,
          question_text: answer.question,
          answer_text: answer.answer,
          answer_source:
            answer.source === "typed"
              ? "typed"
              : answer.source,
          sequence_number: answers.length + 1,
        });

    if (answerError) {
      throw new Error(answerError.message);
    }
  }

  async function submitAnswer(
    value: string,
    source: Answer["source"]
  ) {
    if (!currentQuestion) return;

    let answerText = value.trim();

    /*
     * Medicine question:
     * selected medicines are stored as a JSON array of names.
     */
    if (currentQuestion.key === "medicine_names") {
      const nextMedicines = [...selectedMedicines];

      if (answerText) {
        const exists = nextMedicines.some(
          (medicine) =>
            medicine.name.toLowerCase() ===
            answerText.toLowerCase()
        );

        if (!exists) {
          nextMedicines.push({
            name: answerText,
          });
        }
      }

      if (nextMedicines.length === 0) {
        setError(
          language === "hi-IN"
            ? "कृपया कम से कम एक दवा चुनें या उसका नाम लिखें।"
            : "Please select or enter at least one medicine."
        );

        return;
      }

      setSelectedMedicines(nextMedicines);

      answerText = JSON.stringify(
        nextMedicines
          .map((medicine) => medicine.name.trim())
          .filter(Boolean)
      );
    }

    if (!answerText) {
      setError(
        language === "hi-IN"
          ? "कृपया अपना उत्तर दें।"
          : "Please provide an answer."
      );

      return;
    }

    setError("");
    setSavedMessage("");

    const answer: Answer = {
      key: currentQuestion.key,
      section: currentSection,
      question: currentQuestion.question,
      answer: answerText,
      source,
    };

    const isEdit = answers.some(
      (a) => a.key === answer.key
    );

    const nextAnswers = isEdit
      ? answers.map((a) =>
          a.key === answer.key ? answer : a
        )
      : [...answers, answer];

    setAnswers(nextAnswers);
    setDraft("");

    try {
      await persistAnswer(answer, isEdit);

      /*
       * These are the final questions of their sections.
       * Move to the next section after persistence succeeds.
       */
      if (
        currentQuestion.key === "hpi_complete" ||
        currentQuestion.key === "medications_complete" ||
        (currentSection !== "hpi" &&
          currentSection !== "medications_allergies")
      ) {
        setSectionIndex((index) =>
          Math.min(
            index + 1,
            sectionOrder.length - 1
          )
        );
      }

      /*
       * Review of Systems is the final section.
       */
      if (currentSection === "review_of_systems") {
        await moveToReview(nextAnswers);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save this answer."
      );
    }
  }

  async function moveToReview(
    finalAnswers: Answer[]
  ) {
    if (!interviewId) return;

    const urgent = hasUrgentFlag(finalAnswers);

    const { error: updateError } =
      await supabase
        .from("clinical_interviews")
        .update({
          status: "review",
          current_section: "review",
          chief_complaint:
            finalAnswers.find(
              (a) => a.key === "chief_complaint"
            )?.answer || null,
          structured_history:
            buildStructuredHistory(finalAnswers),
          summary: buildSummary(finalAnswers),
          red_flags: urgent
            ? [
                {
                  type: "potentially_urgent_symptom",
                  message:
                    "A symptom entered during the interview may need prompt medical assessment.",
                },
              ]
            : [],
        })
        .eq("id", interviewId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    setSectionIndex(sectionOrder.length);
  }

  async function confirmInterview() {
    if (
      !interviewId ||
      !familyMember ||
      !userId
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const urgent = hasUrgentFlag(answers);
      const structured =
        buildStructuredHistory(answers);
      const summary = buildSummary(answers);

      const complaint =
        answers.find(
          (a) => a.key === "chief_complaint"
        )?.answer || "Clinical history";

      const { data: record, error: recordError } =
        await supabase
          .from("health_records")
          .insert({
            family_member_id: familyMember.id,
            record_type: "doctor_visit",
            title: `Clinical history — ${complaint.slice(
              0,
              70
            )}`,
            record_date: new Date()
              .toISOString()
              .slice(0, 10),
            diagnosis: null,
            summary,
            patient_name: familyMember.name,
            medicines: [],
            lab_metrics: [],
            metadata: {
              source: "clinical_interview",
              interview_id: interviewId,
              structured_history: structured,
              red_flags: urgent
                ? [
                    {
                      type: "potentially_urgent_symptom",
                    },
                  ]
                : [],
            },
            status: "processed",
            source: "clinical_interview",
          })
          .select("id")
          .single();

      if (recordError || !record) {
        throw new Error(
          recordError?.message ||
            "Could not create the clinical history record."
        );
      }

      const { error: timelineError } =
        await supabase
          .from("timeline_events")
          .insert({
            family_member_id: familyMember.id,
            health_record_id: record.id,
            event_type:
              "clinical_history_completed",
            event_date: new Date().toISOString(),
            title: "Clinical history completed",
            description:
              "Patient-reported history reviewed and confirmed.",
            metadata: {
              interview_id: interviewId,
            },
          });

      if (timelineError) {
        throw new Error(timelineError.message);
      }

      const { error: auditError } =
        await supabase
          .from("audit_logs")
          .insert({
            actor_id: userId,
            actor_role: "patient",
            family_member_id: familyMember.id,
            health_record_id: record.id,
            action:
              "clinical_history_confirmed",
            metadata: {
              interview_id: interviewId,
              source: "patient_interview",
            },
          });

      if (auditError) {
        throw new Error(auditError.message);
      }

      const { error: interviewError } =
        await supabase
          .from("clinical_interviews")
          .update({
            status: "confirmed",
            patient_verified: true,
            verified_at: new Date().toISOString(),
            completed_at:
              new Date().toISOString(),
            structured_history: structured,
            summary,
            red_flags: urgent
              ? [
                  {
                    type: "potentially_urgent_symptom",
                    message:
                      "A symptom entered during the interview may need prompt medical assessment.",
                  },
                ]
              : [],
          })
          .eq("id", interviewId);

      if (interviewError) {
        throw new Error(interviewError.message);
      }

      setSavedMessage(
        "Your clinical history is saved in your health locker."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the clinical history."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!started) {
    return (
      <div className="app-content">
        <header className="app-header">
          <div className="brand">
            <div className="brand-name">
              Aarogya<span>Vaani</span>
            </div>
            <div className="brand-subtitle">
              Clinical History
            </div>
          </div>

          <Link
            href="/dashboard"
            className="profile-button"
            aria-label="Back to dashboard"
          >
            ←
          </Link>
        </header>

        <section className="card card-padding">
          <p className="eyebrow">
            Patient-led clinical intake
          </p>

          <h1 className="page-title">
            Tell your doctor what is going on.
          </h1>

          <p className="page-subtitle">
            Answer simple questions in your own words.
            AarogyaVaani organizes your answers into a
            structured history for review. It does not
            diagnose you.
          </p>

          <div
            className="form-group"
            style={{ marginTop: 20 }}
          >
            <label className="form-label">
              Language
            </label>

            <div className="choice-grid">
              <button
                className={`choice-card ${
                  language === "en-IN"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setLanguage("en-IN")
                }
              >
                English
                <br />
                <span>India</span>
              </button>

              <button
                className={`choice-card ${
                  language === "hi-IN"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setLanguage("hi-IN")
                }
              >
                हिन्दी
                <br />
                <span>भारत</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              How would you like to answer?
            </label>

            <div className="choice-grid">
              <button
                className={`choice-card ${
                  mode === "mixed"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setMode("mixed")
                }
              >
                Voice + touch
                <br />
                <span>Recommended</span>
              </button>

              <button
                className={`choice-card ${
                  mode === "touch"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setMode("touch")
                }
              >
                Touch + typing
                <br />
                <span>Quiet mode</span>
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            disabled={!familyMember}
            onClick={async () => {
              const ok = await createInterview();

              if (ok) {
                setStarted(true);
              }
            }}
          >
            Start health interview
          </button>

          <div className="disclaimer">
            Your answers are stored under the selected
            family profile. You can review them before
            confirming the final clinical history.
          </div>
        </section>

        <BottomNav />
      </div>
    );
  }

  /*
   * Review screen.
   *
   * sectionIndex === sectionOrder.length means that the
   * interview is complete and ready for patient review.
   */
  if (sectionIndex >= sectionOrder.length) {
    const urgent = hasUrgentFlag(answers);

    return (
      <div className="app-content">
        <header className="app-header">
          <div className="brand">
            <div className="brand-name">
              Aarogya<span>Vaani</span>
            </div>

            <div className="brand-subtitle">
              Review before saving
            </div>
          </div>

          <Link
            href="/dashboard"
            className="profile-button"
            aria-label="Close"
          >
            ×
          </Link>
        </header>

        <section className="card card-padding">
          <p className="eyebrow">
            Step 3 · Review
          </p>

          <h1 className="page-title">
            Your clinical history
          </h1>

          <p className="page-subtitle">
            Check the information before it becomes part
            of your health record.
          </p>

          {urgent && (
            <div
              className="status status-warning"
              style={{ margin: "14px 0" }}
            >
              Some symptoms may need prompt medical
              assessment.
            </div>
          )}

          <div className="history-review">
            {sectionOrder.map((section) => {
              const sectionAnswers = answers.filter(
                (a) => a.section === section
              );

              if (!sectionAnswers.length) {
                return null;
              }

              return (
                <div
                  className="history-section"
                  key={section}
                >
                  <h2>
                    {sectionLabels[section]}
                  </h2>

                  {sectionAnswers.map(
                    (a, answerIndex) => (
                      <div
                        className="history-answer"
                        key={`${section}-${a.key}-${answerIndex}`}
                      >
                        <span>{a.question}</span>

                        {a.key ===
                        "medicine_names" ? (
                          (() => {
                            let medicines: string[] =
                              [];

                            try {
                              const parsed =
                                JSON.parse(
                                  a.answer
                                );

                              if (
                                Array.isArray(
                                  parsed
                                )
                              ) {
                                medicines =
                                  parsed.filter(
                                    (
                                      item
                                    ) =>
                                      typeof item ===
                                      "string"
                                  );
                              }
                            } catch {
                              medicines = [
                                a.answer,
                              ];
                            }

                            return (
                              <div className="review-medicine-list">
                                {medicines.map(
                                  (
                                    medicine
                                  ) => (
                                    <span
                                      className="medicine-chip"
                                      key={medicine}
                                    >
                                      {
                                        medicine
                                      }
                                    </span>
                                  )
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <strong>
                            {a.answer}
                          </strong>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          <div className="disclaimer">
            AI-assisted structuring is not a diagnosis or
            medical advice. Your doctor should review and
            confirm the clinical history.
          </div>

          {error && (
            <div
              className="status status-danger"
              style={{ marginTop: 12 }}
            >
              {error}
            </div>
          )}

          {savedMessage && (
            <div
              className="status status-success"
              style={{ marginTop: 12 }}
            >
              {savedMessage}
            </div>
          )}

          <div
            className="history-edit-grid"
            style={{ marginTop: 16 }}
          >
            <span className="form-label">
              Edit a section
            </span>

            <div className="choice-grid">
              {sectionOrder.map((section) => (
                <button
                  key={section}
                  className="choice-card"
                  onClick={() => {
                    setSavedMessage("");
                    setError("");

                    setSectionIndex(
                      sectionOrder.indexOf(
                        section
                      )
                    );

                    const last = [
                      ...answers,
                    ]
                      .reverse()
                      .find(
                        (a) =>
                          a.section ===
                          section
                      );

                    if (
                      section ===
                        "medications_allergies" &&
                      last?.key ===
                        "medicine_names"
                    ) {
                      try {
                        const parsed =
                          JSON.parse(
                            last.answer
                          );

                        if (
                          Array.isArray(
                            parsed
                          )
                        ) {
                          setSelectedMedicines(
                            parsed
                              .filter(
                                (
                                  name
                                ) =>
                                  typeof name ===
                                    "string" &&
                                  name.trim()
                                    .length >
                                    0
                              )
                              .map(
                                (
                                  name
                                ) => ({
                                  name: name.trim(),
                                })
                              )
                          );
                        } else {
                          setSelectedMedicines(
                            [
                              {
                                name:
                                  last.answer,
                              },
                            ]
                          );
                        }
                      } catch {
                        setSelectedMedicines(
                          [
                            {
                              name:
                                last.answer,
                            },
                          ]
                        );
                      }

                      setDraft("");
                    } else {
                      setDraft(
                        last?.answer || ""
                      );
                    }
                  }}
                >
                  {sectionLabels[section]}
                </button>
              ))}
            </div>
          </div>

          <div
            className="button-row"
            style={{ marginTop: 16 }}
          >
            <button
              className="btn btn-primary"
              disabled={
                saving ||
                Boolean(savedMessage)
              }
              onClick={confirmInterview}
            >
              {saving
                ? "Saving…"
                : "Confirm & save"}
            </button>
          </div>

          {savedMessage && (
            <Link
              href="/records"
              className="btn btn-secondary btn-full"
              style={{ marginTop: 10 }}
            >
              Open health locker
            </Link>
          )}
        </section>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="app-content">
      <header className="app-header">
        <div className="brand">
          <div className="brand-name">
            Aarogya<span>Vaani</span>
          </div>

          <div className="brand-subtitle">
            Clinical History
          </div>
        </div>

        <Link
          href="/dashboard"
          className="profile-button"
          aria-label="Exit interview"
        >
          ×
        </Link>
      </header>

      <section className="interview-progress">
        <div>
          <span>
            Step {sectionIndex + 1} of{" "}
            {sectionOrder.length}
          </span>

          <strong>
            {sectionLabels[currentSection]}
          </strong>
        </div>

        <div className="progress-track">
          <div
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </section>

      <section className="card card-padding">
        <p className="eyebrow">
          {language === "hi-IN"
            ? "सरल भाषा में जवाब दें"
            : "Use your own words"}
        </p>

        <h1 className="interview-question">
          {currentQuestion.question}
        </h1>

        {currentQuestion.hint && (
          <p className="page-subtitle">
            {currentQuestion.hint}
          </p>
        )}

        {currentQuestion.options && (
          <div className="option-list">
            {currentQuestion.options.map(
              (option) => (
                <button
                  key={option}
                  className="option-button"
                  onClick={() =>
                    submitAnswer(
                      option,
                      "touch"
                    )
                  }
                >
                  {option}
                </button>
              )
            )}
          </div>
        )}

        <div className="interview-input-wrap">
          {currentQuestion.key ===
          "medicine_names" ? (
            <>
              {selectedMedicines.length > 0 && (
                <div
                  className="selected-medicines"
                  aria-label="Selected medicines"
                >
                  {selectedMedicines.map(
                    (medicine) => (
                      <div
                        className="medicine-chip"
                        key={medicine.name}
                      >
                        <span>
                          {medicine.name}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            removeMedicine(
                              medicine.name
                            )
                          }
                          aria-label={`Remove ${medicine.name}`}
                        >
                          ×
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              <input
                className="form-input medicine-input"
                value={draft}
                onChange={(e) =>
                  setDraft(e.target.value)
                }
                placeholder="Type a medicine name…"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    draft.trim()
                  ) {
                    e.preventDefault();

                    addMedicine({
                      name: draft.trim(),
                    });
                  }
                }}
              />

              {medicineSuggestions.length >
                0 && (
                <div
                  className="medicine-suggestions"
                  role="listbox"
                  aria-label="Medicine suggestions"
                >
                  {medicineSuggestions.map(
                    (medicine) => (
                      <button
                        type="button"
                        key={medicine.name}
                        className="medicine-suggestion"
                        onClick={() =>
                          addMedicine(
                            medicine
                          )
                        }
                      >
                        <strong>
                          {medicine.name}
                        </strong>

                        {medicine.composition ? (
                          <span>
                            {
                              medicine.composition
                            }
                          </span>
                        ) : (
                          <span>
                            Medicine catalogue
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}

              {draft.trim() && (
                <button
                  type="button"
                  className="add-medicine-button"
                  onClick={() =>
                    addMedicine({
                      name: draft.trim(),
                    })
                  }
                >
                  + Add “
                  {draft.trim()}
                  ” manually
                </button>
              )}

              {draft.trim().length >= 2 &&
                medicineLoading && (
                  <div className="medicine-loading">
                    Searching medicine
                    catalogue…
                  </div>
                )}
            </>
          ) : (
            <textarea
              className="form-textarea interview-input"
              value={draft}
              onChange={(e) =>
                setDraft(e.target.value)
              }
              placeholder={
                language === "hi-IN"
                  ? "यहाँ अपना जवाब लिखें…"
                  : "Type your answer here…"
              }
            />
          )}
        </div>

        {error && (
          <div
            className="status status-danger"
            style={{ marginBottom: 12 }}
          >
            {error}
          </div>
        )}

        <div className="interview-controls">
          <button
            className={`voice-button ${
              listening
                ? "listening"
                : ""
            }`}
            onClick={startListening}
            disabled={
              !speechSupported ||
              listening
            }
            aria-label="Speak answer"
          >
            {listening
              ? "Listening…"
              : "🎙 Speak"}
          </button>

          <button
            className="voice-button"
            onClick={speakQuestion}
            aria-label="Read question aloud"
          >
            🔊 Read aloud
          </button>
        </div>

        {!speechSupported && (
          <p className="disclaimer">
            Voice input is not available in this
            browser. Typing and touch answers are still
            available.
          </p>
        )}

        <button
          className="btn btn-primary btn-full"
          style={{ marginTop: 14 }}
          onClick={() =>
            submitAnswer(
              currentQuestion.key ===
                "medicine_names"
                ? medicineAnswerValue()
                : draft,
              draft
                ? mode === "voice"
                  ? "voice"
                  : "typed"
                : "typed"
            )
          }
        >
          Continue
        </button>
      </section>

      <div className="disclaimer">
        AarogyaVaani records what you report. It does not
        independently diagnose or prescribe.
      </div>

      <BottomNav />
    </div>
  );
}