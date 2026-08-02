// Surface-level localization (UI strings only, no logic/data changes) — see the language
// research this session: govt e-governance precedent (localization.gov.in) treats this as
// "surface localization," distinct from deeper locale-aware formatting. Deliberately scoped
// to the highest-traffic surfaces first (login/signup, nav, dashboard, report submission —
// the primary workflow for the field-level roles most likely to prefer Hindi) rather than
// attempting every string in the app in one pass.
export type Language = 'en' | 'hi';

export const translations = {
  // ── Login / Signup page ──
  appTagline: { en: 'Enterprise Health Management Information System', hi: 'स्वास्थ्य प्रबंधन सूचना प्रणाली' },
  featureReporting: { en: 'Multi-tier facility reporting & compliance', hi: 'बहु-स्तरीय सुविधा रिपोर्टिंग एवं अनुपालन' },
  featureAI: { en: 'AI-powered sentiment analysis & OCR extraction', hi: 'AI-आधारित भावना विश्लेषण एवं OCR' },
  featureDashboards: { en: 'Real-time executive KPI dashboards', hi: 'वास्तविक-समय KPI डैशबोर्ड' },
  signIn: { en: 'Sign In', hi: 'साइन इन करें' },
  signUp: { en: 'Sign Up', hi: 'साइन अप करें' },
  welcomeBack: { en: 'Welcome Back', hi: 'वापसी पर स्वागत है' },
  createAccount: { en: 'Create Account', hi: 'खाता बनाएं' },
  signInSubtitle: { en: 'Sign in to access your dashboard', hi: 'अपने डैशबोर्ड तक पहुंचने के लिए साइन इन करें' },
  signUpSubtitle: { en: 'Join the HealthConnect network', hi: 'HealthConnect नेटवर्क से जुड़ें' },
  fullName: { en: 'Full Name', hi: 'पूरा नाम' },
  emailAddress: { en: 'Email Address', hi: 'ईमेल पता' },
  password: { en: 'Password', hi: 'पासवर्ड' },
  role: { en: 'Role', hi: 'भूमिका' },
  facilityCode: { en: 'Facility Code / ID', hi: 'सुविधा कोड / आईडी' },
  processing: { en: 'Processing...', hi: 'प्रोसेस हो रहा है...' },
  selectRole: { en: 'Select Role...', hi: 'भूमिका चुनें...' },
  placeholderName: { en: 'e.g. Dr. Rajesh Thakur', hi: 'उदा. डॉ. राजेश ठाकुर' },
  placeholderEmail: { en: 'name@healthconnect.gov.in', hi: 'name@healthconnect.gov.in' },
  placeholderPassword: { en: '••••••••', hi: '••••••••' },
  placeholderFacility: { en: 'e.g. 59526000000027011', hi: 'उदा. 59526000000027011' },

  // ── Navbar ──
  navDashboard: { en: 'Dashboard', hi: 'डैशबोर्ड' },
  navFacilities: { en: 'Facilities', hi: 'सुविधाएं' },
  navReports: { en: 'Reports', hi: 'रिपोर्ट' },
  navPatients: { en: 'Patients', hi: 'मरीज़' },
  navInventory: { en: 'Inventory', hi: 'भंडार' },
  navFeedback: { en: 'Feedback', hi: 'प्रतिक्रिया' },
  navAdmin: { en: 'Admin', hi: 'व्यवस्थापक' },
  logout: { en: 'Logout', hi: 'लॉग आउट' },

  // ── Dashboard ──
  commandCenter: { en: 'Command Center', hi: 'कमांड सेंटर' },
  welcomeBackUser: { en: 'Welcome back', hi: 'वापसी पर स्वागत है' },
  overview: { en: 'Overview', hi: 'अवलोकन' },
  submitNewReport: { en: 'Submit New Report', hi: 'नई रिपोर्ट सबमिट करें' },

  // ── Submit Report Form ──
  submitReportTitle: { en: 'Submit New Facility Report', hi: 'नई सुविधा रिपोर्ट सबमिट करें' },
  facility: { en: 'Facility', hi: 'सुविधा' },
  reportingCycle: { en: 'Reporting Cycle', hi: 'रिपोर्टिंग चक्र' },
  selectFacility: { en: 'Select Facility...', hi: 'सुविधा चुनें...' },
  selectCycle: { en: 'Select Cycle...', hi: 'चक्र चुनें...' },
  healthIndicators: { en: 'Health Indicators', hi: 'स्वास्थ्य संकेतक' },
  enterValue: { en: 'Enter value', hi: 'मान दर्ज करें' },
  submitReport: { en: 'Submit Report', hi: 'रिपोर्ट सबमिट करें' },
  submitting: { en: 'Submitting...', hi: 'सबमिट हो रहा है...' },
  submitSuccess: { en: 'Report submitted successfully! Redirecting...', hi: 'रिपोर्ट सफलतापूर्वक सबमिट हुई! रीडायरेक्ट हो रहा है...' },

  // ── Common ──
  save: { en: 'Save Changes', hi: 'परिवर्तन सहेजें' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  loading: { en: 'Loading...', hi: 'लोड हो रहा है...' },
} as const;

export type TranslationKey = keyof typeof translations;
