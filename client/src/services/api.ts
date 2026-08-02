// ─────────────────────────────────────────────
// HealthConnect Pro — API Service Layer
// Centralized fetch client for Catalyst Functions
// ─────────────────────────────────────────────

import type {
  Facility, HealthReport, DashboardStats,
  Indicator, FeedbackLog, SentimentTriage, SupplyRequest,
  FacilityInventory, InventoryMaster, Department,
  ReportingCycle, CurrentUser, User, Patient,
  WorkflowHistoryEntry, OverdueFacility,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL || '/server/healthconnect_api/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API request failed');
  return json.data;
}

// ── Auth / Users ──
export const getMe = () => request<CurrentUser>('/users/me');
export const getUsers = () => request<User[]>('/users');
export const createUser = (data: Partial<User>) =>
  request<User>('/users', { method: 'POST', body: JSON.stringify(data) });

export const loginWithCredentials = (data: { email: string; password?: string }) =>
  request<CurrentUser>('/auth/login', { method: 'POST', body: JSON.stringify(data) });

export const registerNewUser = (data: { email: string; password?: string; name: string; role: string; facilityId?: string }) =>
  request<CurrentUser>('/auth/signup', { method: 'POST', body: JSON.stringify(data) });


// ── Facilities ──
export const getFacilities = () => request<Facility[]>('/facilities');
export const getFacility = (id: string) => request<Facility>(`/facilities/${id}`);
export const createFacility = (data: Partial<Facility>) =>
  request<Facility>('/facilities', { method: 'POST', body: JSON.stringify(data) });
export const updateFacility = (id: string, data: Partial<Facility>) =>
  request<Facility>(`/facilities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFacility = (id: string) =>
  request<void>(`/facilities/${id}`, { method: 'DELETE' });

// ── Departments ──
export const getDepartments = () => request<Department[]>('/departments');
export const createDepartment = (data: Partial<Department>) =>
  request<Department>('/departments', { method: 'POST', body: JSON.stringify(data) });

// ── Reporting Cycles ──
export const getCycles = () => request<ReportingCycle[]>('/cycles');
export const createCycle = (data: Partial<ReportingCycle>) =>
  request<ReportingCycle>('/cycles', { method: 'POST', body: JSON.stringify(data) });

// ── Indicators ──
export const getIndicators = (deptId?: string) =>
  request<Indicator[]>(`/indicators${deptId ? `?dept_id=${deptId}` : ''}`);
export const createIndicator = (data: Partial<Indicator>) =>
  request<Indicator>('/indicators', { method: 'POST', body: JSON.stringify(data) });

// ── Reports ──
export const getReports = (params?: { facility_id?: string; status?: string; cycle_id?: string }) => {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return request<HealthReport[]>(`/reports${qs}`);
};
export const getReport = (id: string) => request<HealthReport>(`/reports/${id}`);
export const submitNewReport = (data: { facility_id: string; cycle_id?: string; indicators: { indicator_id: string; value: string; notes?: string }[] }) =>
  request<HealthReport>('/reports/submit', { method: 'POST', body: JSON.stringify(data) });
export const submitReportForApproval = (id: string) =>
  request<HealthReport>(`/reports/${id}/submit`, { method: 'PUT' });
export const approveReport = (data: { report_id: string; status: string; notes?: string }) =>
  request<HealthReport>('/reports/approve', { method: 'PUT', body: JSON.stringify(data) });
export const approveReportById = (id: string, data: { status: string; comments?: string }) =>
  request<HealthReport>(`/reports/${id}/approve`, { method: 'POST', body: JSON.stringify(data) });
export const endorseReport = (id: string, comments?: string) =>
  request<HealthReport>(`/reports/${id}/endorse`, { method: 'POST', body: JSON.stringify({ comments }) });
export const updateReportData = (id: string, indicators: { ROWID?: string; indicator_id: string; value: string; notes?: string }[]) =>
  request<unknown>(`/reports/${id}/data`, { method: 'PUT', body: JSON.stringify({ indicators }) });
export const getActivityLog = () => request<WorkflowHistoryEntry[]>('/reports/activity-log');
export const getOverdueReports = () => request<OverdueFacility[]>('/reports/overdue');

// ── Inventory ──
export const getInventoryMaster = () => request<InventoryMaster[]>('/inventory/master');
export const createInventoryItem = (data: Partial<InventoryMaster>) =>
  request<InventoryMaster>('/inventory/master', { method: 'POST', body: JSON.stringify(data) });
export const getFacilityInventory = (facilityId?: string) =>
  request<FacilityInventory[]>(`/inventory/facility${facilityId ? `?facility_id=${facilityId}` : ''}`);
export const updateFacilityStock = (id: string, stock: number) =>
  request<FacilityInventory>(`/inventory/facility/${id}`, { method: 'PUT', body: JSON.stringify({ Current_Stock: stock }) });
export const getSupplyRequests = (facilityId?: string) =>
  request<SupplyRequest[]>(`/inventory/requests${facilityId ? `?facility_id=${facilityId}` : ''}`);
export const createSupplyRequest = (data: Partial<SupplyRequest>) =>
  request<SupplyRequest>('/inventory/requests', { method: 'POST', body: JSON.stringify(data) });
export const transferInventory = (data: { origin_facility_id: string; destination_facility_id: string; item_id: string; quantity: number; request_id?: string }) =>
  request<{message: string}>('/inventory/re-route', { method: 'POST', body: JSON.stringify(data) });

// ── Feedback ──
export const getFeedback = (facilityId?: string) =>
  request<FeedbackLog[]>(`/feedback${facilityId ? `?facility_id=${facilityId}` : ''}`);
export const submitFeedback = (data: { Facility_ID: string; Patient_ID?: string; Feedback_Text: string }) =>
  request<{ feedback: FeedbackLog; sentiment: SentimentTriage | null }>('/feedback', { method: 'POST', body: JSON.stringify(data) });
export const analyzeSentiment = (text: string) =>
  request<unknown>('/feedback/analyze', { method: 'POST', body: JSON.stringify({ feedback_text: text }) });
export const getTriageAlerts = () => request<SentimentTriage[]>('/triage');
export const getEscalatedGrievances = () => request<any[]>('/grievances/escalated');

// ── Patients ──
export const getPatients = (facilityId?: string) =>
  request<Patient[]>(`/patients${facilityId ? `?facility_id=${facilityId}` : ''}`);
export const createPatient = (data: Partial<Patient>) =>
  request<Patient>('/patients', { method: 'POST', body: JSON.stringify(data) });
export const updatePatient = (id: string, data: Partial<Patient>) =>
  request<Patient>(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Dashboard ──
export const getDashboard = () => request<DashboardStats>('/dashboard');

// ── OCR ──
export const extractOCR = (imageBase64: string, mimeType?: string) =>
  request<{ text: string }>('/ocr/extract', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }) });

// ── AI Chat ──
export const chatWithAI = (message: string, history: { role: 'user' | 'model'; text: string }[]) =>
  request<{ reply: string }>('/chat', { method: 'POST', body: JSON.stringify({ message, history }) });
