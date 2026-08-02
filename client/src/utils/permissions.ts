// Shared, single-source-of-truth check for whether a role may perform write actions
// (create/edit/delete/approve/escalate). Auditor is the only fully read-only role today;
// centralizing the check here means new roles or new write-gated buttons only need to
// call canWrite() instead of re-deriving the "is this role read-only" logic everywhere.
//
// canWrite() alone is NOT sufficient to gate most write actions — it only rules out
// Auditor. Most actions in the permission matrix are further restricted to a specific
// subset of the remaining six roles, so pair canWrite() with one of the role-set checks
// below (e.g. canSubmitReport, canLogFeedback) rather than relying on canWrite() alone.
export function canWrite(role?: string | null): boolean {
  return role !== 'Auditor';
}

// The three "officer-tier" roles share an identical capability set (approve/reject
// reports, escalate grievances, re-route inventory between facilities) and differ only
// in jurisdiction *scope* (handled server-side by getScopedFacilityIds) — not in which
// actions they can take, so they share one role list here.
const REVIEW_ROLES = ['State_Admin', 'District_Officer', 'Block_Officer'];

export function canReviewReports(role?: string | null): boolean {
  return REVIEW_ROLES.includes(role || '');
}

export function canEscalateGrievance(role?: string | null): boolean {
  return REVIEW_ROLES.includes(role || '');
}

export function canReRouteInventory(role?: string | null): boolean {
  return REVIEW_ROLES.includes(role || '');
}

// Only the two facility-level data-entry roles submit health reports (new drafts and
// submitting a draft for approval).
const REPORT_SUBMITTER_ROLES = ['Facility_Staff', 'Data_Entry_Clerk'];

export function canSubmitReport(role?: string | null): boolean {
  return REPORT_SUBMITTER_ROLES.includes(role || '');
}

// Facility_Staff, ASHA_Worker and Staff_Nurse are the roles that actually talk to
// patients day-to-day — officers, Data_Entry_Clerk, Pharmacist, State_Admin and Auditor
// all do not.
const FEEDBACK_LOGGER_ROLES = ['Facility_Staff', 'ASHA_Worker', 'Staff_Nurse'];

export function canLogFeedback(role?: string | null): boolean {
  return FEEDBACK_LOGGER_ROLES.includes(role || '');
}

// Facility_Staff, Pharmacist, ANM and Store_Keeper raise supply requests; Data_Entry_Clerk
// cannot. ANM covers basic sub-center stock; Store_Keeper covers non-pharmaceutical
// facility stock (see canRequestNonPharmaOnly).
const SUPPLY_REQUEST_ROLES = ['Facility_Staff', 'Pharmacist', 'ANM', 'Store_Keeper'];

export function canCreateSupplyRequest(role?: string | null): boolean {
  return SUPPLY_REQUEST_ROLES.includes(role || '');
}

// Only State_Admin manages the facility directory, the inventory master catalog, and
// admin config (Departments/Cycles/Indicators).
export function isStateAdmin(role?: string | null): boolean {
  return role === 'State_Admin';
}

// The five front-line roles that actually register a new patient at their facility —
// see the role hierarchy table: Doctor, Staff_Nurse, ASHA_Worker and ANM all register
// patients as part of their clinical/community duties, and Registration_Clerk exists
// solely for this ("parchi"/OPD token registration is its only capability).
const PATIENT_REGISTRAR_ROLES = ['Doctor', 'Staff_Nurse', 'ASHA_Worker', 'ANM', 'Registration_Clerk'];

export function canRegisterPatient(role?: string | null): boolean {
  return PATIENT_REGISTRAR_ROLES.includes(role || '');
}

// Staff_Nurse is the only role that can update/edit an existing patient record — every
// other role can only create new ones (or, for Facility_Head/Facility_Supervisor, only
// view them read-only).
export function canEditPatient(role?: string | null): boolean {
  return role === 'Staff_Nurse';
}

// Store_Keeper's inventory read/write access is scoped to non-pharmaceutical categories
// only (Equipment, PPE, Medical Supplies, Laboratory) — Pharmaceuticals stays exclusively
// Pharmacist's domain. Mirrors the backend category gate in inventory.routes.js.
export function isStoreKeeper(role?: string | null): boolean {
  return role === 'Store_Keeper';
}

// Mirrors the requireRole list on PUT /inventory/facility/:id — who may record a stock
// count change for a facility's on-hand inventory.
const STOCK_UPDATE_ROLES = ['State_Admin', 'District_Officer', 'Block_Officer', 'Facility_Staff', 'Pharmacist', 'Store_Keeper'];

export function canUpdateStock(role?: string | null): boolean {
  return STOCK_UPDATE_ROLES.includes(role || '');
}

// Only Facility_Head endorses a Submitted report before it reaches an officer's approval
// queue — the one write action below officer-tier in the approval chain.
export function canEndorseReport(role?: string | null): boolean {
  return role === 'Facility_Head';
}

// ── Nav-level page visibility ──
// Each function lists exactly the roles with a genuine reason to see that page — see the
// role hierarchy table. Deliberately explicit per-role inclusion rather than a handful of
// exclusion booleans, since that pattern stopped being legible past ~4 roles at 15 roles.
// Single source of truth for Navbar.tsx — do not re-derive these role lists elsewhere.

const FULL_NETWORK_VIEW_ROLES = ['State_Admin', 'District_Officer', 'Block_Officer', 'Auditor'];

// Facility-scoped roles only ever see their own single facility in that directory
// (jurisdiction scoping), so it's a near-empty page for them — not worth a nav slot.
export function hasFullNetworkView(role?: string | null): boolean {
  return FULL_NETWORK_VIEW_ROLES.includes(role || '');
}

const REPORTS_NAV_ROLES = ['State_Admin', 'District_Officer', 'Block_Officer', 'Auditor', 'Facility_Staff', 'Data_Entry_Clerk', 'Facility_Head', 'Facility_Supervisor'];

export function canSeeReportsNav(role?: string | null): boolean {
  return REPORTS_NAV_ROLES.includes(role || '');
}

const INVENTORY_NAV_ROLES = ['State_Admin', 'District_Officer', 'Block_Officer', 'Auditor', 'Facility_Staff', 'Pharmacist', 'Doctor', 'ANM', 'Store_Keeper', 'Facility_Head', 'Facility_Supervisor'];

export function canSeeInventoryNav(role?: string | null): boolean {
  return INVENTORY_NAV_ROLES.includes(role || '');
}

const FEEDBACK_NAV_ROLES = ['State_Admin', 'District_Officer', 'Block_Officer', 'Auditor', 'Facility_Staff', 'ASHA_Worker', 'Staff_Nurse', 'Facility_Head', 'Facility_Supervisor'];

export function canSeeFeedbackNav(role?: string | null): boolean {
  return FEEDBACK_NAV_ROLES.includes(role || '');
}

const PATIENTS_NAV_ROLES = ['Doctor', 'Staff_Nurse', 'ASHA_Worker', 'ANM', 'Registration_Clerk', 'Facility_Head', 'Facility_Supervisor'];

export function canSeePatientsNav(role?: string | null): boolean {
  return PATIENTS_NAV_ROLES.includes(role || '');
}

export function canSeeAdminNav(role?: string | null): boolean {
  return role === 'State_Admin' || role === 'Auditor';
}
