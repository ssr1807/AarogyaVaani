"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppLanguage = "en-IN" | "hi-IN";

type TranslationKey = keyof typeof translations.en;

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  isHindi: boolean;
  t: (key: TranslationKey) => string;
};

const STORAGE_KEY = "aarogyavaani-language";

const translations = {
  en: {
    home: "Home",
    records: "Records",
    scan: "Scan",
    profile: "Profile",
    account: "Account",
    profileSettings: "Profile & settings",
    manageProfile:
      "Manage your profile, family members, language and privacy preferences.",
    fullName: "Full name",
    email: "Email",
    preferredLanguage: "Preferred language",
    saveProfile: "Save profile",
    saving: "Saving…",
    familyProfiles: "Family profiles",
    add: "+ Add",
    cancel: "Cancel",
    name: "Name",
    relationship: "Relationship",
    mother: "Mother",
    father: "Father",
    sister: "Sister",
    brother: "Brother",
    spouse: "Spouse",
    child: "Child",
    grandparent: "Grandparent",
    other: "Other",
    addFamilyMember: "Add family member",
    adding: "Adding…",
    privacySecurity: "Privacy & security",
    yourHealthData:
      "Your health data stays under your control",
    originalDocuments:
      "Original documents are stored in private health-document storage. Sharing should only happen with your permission.",
    welcomeBack: "Welcome back,",
    yourHealthRecords: "Your health records",
    yourLocker: "Your locker",
    recentRecords: "Recent records",
    prescriptions: "Prescriptions",
    labReports: "Lab reports",
    doctorVisits: "Doctor visits",
    diagnoses: "Diagnoses",
    imaging: "Imaging",
    vaccinations: "Vaccinations",
    healthRecord: "Health record",
    addRecord: "+ Add record",
    scanDocument: "Scan document",
    startHealthHistory: "Start health history",
    manage: "Manage",
    recentActivity: "Recent activity",
    viewAll: "View all",
    noRecords: "No records yet",
    addFirstRecord:
      "Add your first prescription, lab report, or medical document to start building your health timeline.",
    addFirstRecordButton: "Add your first record",
    yourDataYourControl: "Your data, your control.",
    loading: "Loading…",
    loadingProfile: "Loading your profile…",
    digitalHealthLocker: "Digital Health Locker",
    clinicalHistory: "Clinical history",
    chiefComplaint: "Chief complaint",
    hpi: "History of Present Illness (HPI)",
    pastMedicalHistory: "Past medical history",
    surgicalHistory: "Surgical history",
    medicinesAllergies: "Medicines & allergies",
    familyHistory: "Family history",
    personalHistory: "Personal history",
    reviewOfSystems: "Review of Systems",
    whatBothersYou: "What is bothering you today?",
    wherePain: "Where do you feel the pain?",
    whenStarted: "When did it start?",
    severity: "How severe is it right now?",
    feverDuration: "How long have you had the fever?",
    problemBegin: "When did this problem begin?",
    problemCourse:
      "Since it started, has it been getting better, worse, or staying about the same?",
    otherSymptoms: "Are there any other symptoms you have noticed?",
    anythingElse:
      "Is there anything else about this problem that you want the doctor to know?",
    longTermCondition:
      "Have you ever been told by a doctor that you have a long-term medical condition?",
    hadSurgery: "Have you ever had an operation or surgery?",
    regularMedicines:
      "Do you currently take any regular medicines?",
    closeFamilyCondition:
      "Does anyone in your close family have an important medical condition that the doctor should know about?",
    dailyHabits:
      "Is there anything about your daily habits, sleep, food, or activity that the doctor should know?",
    otherSymptomsMention:
      "Apart from what we have discussed, do you have any other symptoms you want to mention?",
    no: "No",
    yes: "Yes",
    notSure: "Not sure",
    mild: "Mild",
    moderate: "Moderate",
    severe: "Severe",
    today: "Today",
    withinDays: "Within a few days",
    withinWeeks: "Within a few weeks",
    moreThanMonth: "More than a month ago",
    lessThanDay: "Less than a day",
    oneToThreeDays: "1–3 days",
    fourToSevenDays: "4–7 days",
    moreThanWeek: "More than a week",
    gettingBetter: "Getting better",
    gettingWorse: "Getting worse",
    aboutSame: "About the same",
    comesAndGoes: "Comes and goes",
    head: "Head",
    chest: "Chest",
    stomach: "Stomach",
    back: "Back",
    jointOrLimb: "Joint or limb",
    loadingYourHealthLocker: "Loading your health locker…",
  },

  hi: {
    home: "होम",
    records: "रिकॉर्ड",
    scan: "स्कैन",
    profile: "प्रोफ़ाइल",
    account: "खाता",
    profileSettings: "प्रोफ़ाइल और सेटिंग्स",
    manageProfile:
      "अपनी प्रोफ़ाइल, परिवार के सदस्यों, भाषा और गोपनीयता की प्राथमिकताएँ प्रबंधित करें।",
    fullName: "पूरा नाम",
    email: "ईमेल",
    preferredLanguage: "पसंदीदा भाषा",
    saveProfile: "प्रोफ़ाइल सेव करें",
    saving: "सेव हो रहा है…",
    familyProfiles: "परिवार की प्रोफ़ाइल",
    add: "+ जोड़ें",
    cancel: "रद्द करें",
    name: "नाम",
    relationship: "रिश्ता",
    mother: "माता",
    father: "पिता",
    sister: "बहन",
    brother: "भाई",
    spouse: "पति / पत्नी",
    child: "बच्चा",
    grandparent: "दादा / दादी / नाना / नानी",
    other: "अन्य",
    addFamilyMember: "परिवार का सदस्य जोड़ें",
    adding: "जोड़ा जा रहा है…",
    privacySecurity: "गोपनीयता और सुरक्षा",
    yourHealthData:
      "आपका स्वास्थ्य डेटा आपके नियंत्रण में रहता है",
    originalDocuments:
      "मूल दस्तावेज़ निजी स्वास्थ्य दस्तावेज़ संग्रह में रखे जाते हैं। साझा करना केवल आपकी अनुमति से होना चाहिए।",
    welcomeBack: "वापसी पर स्वागत है,",
    yourHealthRecords: "आपके स्वास्थ्य रिकॉर्ड",
    yourLocker: "आपका हेल्थ लॉकर",
    recentRecords: "हाल के रिकॉर्ड",
    prescriptions: "प्रिस्क्रिप्शन",
    labReports: "लैब रिपोर्ट",
    doctorVisits: "डॉक्टर के दौरे",
    diagnoses: "निदान",
    imaging: "इमेजिंग",
    vaccinations: "टीकाकरण",
    healthRecord: "स्वास्थ्य रिकॉर्ड",
    addRecord: "+ रिकॉर्ड जोड़ें",
    scanDocument: "दस्तावेज़ स्कैन करें",
    startHealthHistory: "स्वास्थ्य इतिहास शुरू करें",
    manage: "प्रबंधित करें",
    recentActivity: "हाल की गतिविधि",
    viewAll: "सभी देखें",
    noRecords: "अभी कोई रिकॉर्ड नहीं है",
    addFirstRecord:
      "अपनी स्वास्थ्य टाइमलाइन बनाना शुरू करने के लिए पहला प्रिस्क्रिप्शन, लैब रिपोर्ट या मेडिकल दस्तावेज़ जोड़ें।",
    addFirstRecordButton: "पहला रिकॉर्ड जोड़ें",
    yourDataYourControl: "आपका डेटा, आपका नियंत्रण।",
    loading: "लोड हो रहा है…",
    loadingProfile: "आपकी प्रोफ़ाइल लोड हो रही है…",
    digitalHealthLocker: "डिजिटल हेल्थ लॉकर",
    clinicalHistory: "क्लिनिकल इतिहास",
    chiefComplaint: "मुख्य शिकायत",
    hpi: "वर्तमान बीमारी का इतिहास (HPI)",
    pastMedicalHistory: "पिछला चिकित्सीय इतिहास",
    surgicalHistory: "सर्जरी का इतिहास",
    medicinesAllergies: "दवाइयाँ और एलर्जी",
    familyHistory: "पारिवारिक इतिहास",
    personalHistory: "व्यक्तिगत इतिहास",
    reviewOfSystems: "सिस्टम की समीक्षा",
    whatBothersYou: "आज आपको किस परेशानी का सामना करना पड़ रहा है?",
    wherePain: "आपको दर्द कहाँ महसूस हो रहा है?",
    whenStarted: "यह कब शुरू हुआ?",
    severity: "अभी इसकी गंभीरता कितनी है?",
    feverDuration: "आपको बुखार कब से है?",
    problemBegin: "यह समस्या कब शुरू हुई?",
    problemCourse:
      "शुरू होने के बाद से यह बेहतर हो रही है, बिगड़ रही है या लगभग वैसी ही है?",
    otherSymptoms: "क्या आपने कोई अन्य लक्षण महसूस किए हैं?",
    anythingElse:
      "क्या इस समस्या के बारे में और कुछ है जो आप डॉक्टर को बताना चाहते हैं?",
    longTermCondition:
      "क्या कभी किसी डॉक्टर ने आपको किसी लंबे समय से चल रही बीमारी के बारे में बताया है?",
    hadSurgery: "क्या कभी आपकी कोई सर्जरी या ऑपरेशन हुआ है?",
    regularMedicines:
      "क्या आप अभी नियमित रूप से कोई दवाइयाँ लेते हैं?",
    closeFamilyCondition:
      "क्या आपके करीबी परिवार में किसी को ऐसी महत्वपूर्ण बीमारी है जिसके बारे में डॉक्टर को पता होना चाहिए?",
    dailyHabits:
      "क्या आपकी रोज़मर्रा की आदतों, नींद, भोजन या गतिविधि के बारे में कुछ ऐसा है जो डॉक्टर को पता होना चाहिए?",
    otherSymptomsMention:
      "अब तक की चर्चा के अलावा, क्या कोई अन्य लक्षण हैं जिनका आप उल्लेख करना चाहते हैं?",
    no: "नहीं",
    yes: "हाँ",
    notSure: "पता नहीं",
    mild: "हल्का",
    moderate: "मध्यम",
    severe: "गंभीर",
    today: "आज",
    withinDays: "कुछ दिनों के भीतर",
    withinWeeks: "कुछ हफ्तों के भीतर",
    moreThanMonth: "एक महीने से अधिक पहले",
    lessThanDay: "एक दिन से कम",
    oneToThreeDays: "1–3 दिन",
    fourToSevenDays: "4–7 दिन",
    moreThanWeek: "एक सप्ताह से अधिक",
    gettingBetter: "बेहतर हो रहा है",
    gettingWorse: "बिगड़ रहा है",
    aboutSame: "लगभग वैसा ही है",
    comesAndGoes: "कभी होता है, कभी नहीं",
    head: "सिर",
    chest: "सीना",
    stomach: "पेट",
    back: "पीठ",
    jointOrLimb: "जोड़ या हाथ-पैर",
    loadingYourHealthLocker: "आपका हेल्थ लॉकर लोड हो रहा है…",
  },
} as const;

const LanguageContext =
  createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, setLanguageState] =
    useState<AppLanguage>("en-IN");

  useEffect(() => {
    const stored =
      window.localStorage.getItem(STORAGE_KEY);

    if (stored === "hi-IN" || stored === "en-IN") {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(
      STORAGE_KEY,
      language
    );
  }, [language]);

  function setLanguage(nextLanguage: AppLanguage) {
    setLanguageState(nextLanguage);
  }

  function t(key: TranslationKey) {
    return translations[
      language === "hi-IN" ? "hi" : "en"
    ][key];
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isHindi: language === "hi-IN",
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used inside LanguageProvider"
    );
  }

  return context;
}