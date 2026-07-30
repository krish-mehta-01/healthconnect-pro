// ─────────────────────────────────────────────
// HealthConnect Pro — TypeScript Type Definitions
// 14-Table ZCQL Schema + Frontend Models
// ─────────────────────────────────────────────

// ── Module 1: Infrastructure ──

export interface Facility {
  ROWID: string;
  Facility_Name: string;
  Type: 'PHC' | 'CHC' | 'Sub_Center' | 'District_Hospital' | 'State_Hospital';
  District: string;
  Block?: string;
  Capacity: number;
  CREATEDTIME?: string;
  MODIFIEDTIME?: string;
}

export interface Department {
  ROWID: string;
  Dept_Name: string;
  Head_Officer_ID: string;
}

export type UserRole = 'State_Admin' | 'District_Officer' | 'Block_Officer' | 'Facility_Staff';

export interface User {
  ROWID: string;
  Catalyst_Auth_ID: string;
  Role: UserRole;
  Facility_ID: string;
  Full_Name: string;
  email_id?: string;
}

export interface CurrentUser {
  user_id: string;
  role: UserRole;
  facility_id: string | null;
  db_user_id: string | null;
  name: string;
  email_id?: string;
}

export interface ReportingCycle {
  ROWID: string;
  Cycle_Name: string;
  Start_Date: string;
  End_Date: string;
  Status: 'Active' | 'Closed';
}

// ── Module 2: Dynamic Reporting Engine ──

export interface Indicator {
  ROWID: string;
  Indicator_Name: string;
  Data_Type: 'number' | 'text' | 'boolean' | 'percentage';
  Dept_ID: string;
}

export type ReportStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

export interface HealthReport {
  ROWID: string;
  Facility_ID: string;
  Cycle_ID: string;
  Total_Score: string;
  Status: ReportStatus;
  CREATEDTIME?: string;
  MODIFIEDTIME?: string;
  // Joined data
  indicators?: ReportData[];
  history?: WorkflowHistoryEntry[];
  facility_name?: string;
}

export interface ReportData {
  ROWID?: string;
  Report_ID: string;
  Indicator_ID: string;
  Metric_Value: string;
  Notes: string;
  // Joined
  indicator_name?: string;
}

export interface WorkflowHistoryEntry {
  ROWID: string;
  Report_ID: string;
  Action_By: string;
  Status_Change: string;
  Action_Timestamp: string;
  Comments?: string;
}

// ── Module 3: Resource Management ──

export interface InventoryMaster {
  ROWID: string;
  Item_Name: string;
  Category: string;
  Minimum_Threshold: number;
}

export interface FacilityInventory {
  ROWID: string;
  Facility_ID: string;
  Item_ID: string;
  Current_Stock: number;
  Last_Updated: string;
  // Joined
  item_name?: string;
  threshold?: number;
}

export interface SupplyRequest {
  ROWID: string;
  Facility_ID: string;
  Item_ID: string;
  Quantity_Requested: number;
  Status: 'Pending' | 'Approved' | 'Dispatched' | 'Delivered';
  CREATEDTIME?: string;
}

// ── Module 4: Patient Feedback & AI ──

export interface Patient {
  ROWID: string;
  Patient_Name: string;
  Age: string;
  Gender: string;
  Facility_ID: string;
}

export interface FeedbackLog {
  ROWID: string;
  Facility_ID: string;
  Patient_ID: string;
  Feedback_Text: string;
  Created_Date: string;
  CREATEDTIME?: string;
  // Joined
  sentiment?: SentimentTriage;
}

export interface SentimentTriage {
  ROWID: string;
  Feedback_ID: string;
  Sentiment_Score: string;
  Urgency_Flag: boolean;
}

// ── Dashboard ──

export interface DashboardStats {
  totalFacilities: number;
  totalReports: number;
  pendingReports: number;
  approvedReports: number;
  rejectedReports: number;
  draftReports: number;
  recentReports: HealthReport[];
  lowStockAlerts: FacilityInventory[];
  urgentFeedback: SentimentTriage[];
  facilityPerformance: { name: string; score: number }[];
}

// ── API Response ──

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  alert?: {
    type: string;
    item: string;
    current: number;
    threshold: number;
  };
}
