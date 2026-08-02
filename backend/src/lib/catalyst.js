'use strict';

const catalyst = require('zcatalyst-sdk-node');

// Real Data Store table names (confirmed against the console — do not rename)
const TABLES = {
  FACILITIES: 'Facilities',
  DEPARTMENTS: 'Departments',
  USERS: 'Users',
  REPORTING_CYCLES: 'ReportingCycles',
  INDICATORS: 'Indicators',
  HEALTH_REPORTS: 'HealthReports',
  REPORT_DATA: 'Report_Data',
  WORKFLOW_HISTORY: 'WorkflowHistory',
  INVENTORY_MASTER: 'Inventory_Master',
  FACILITY_INVENTORY: 'Facility_Inventory',
  SUPPLY_REQUESTS: 'Supply_Requests',
  PATIENTS: 'Patients',
  FEEDBACK_LOGS: 'Feedback_Logs',
  SENTIMENT_TRIAGE: 'Zia_Sentiment_Triage',
};

function getApp(req) {
  return catalyst.initialize(req);
}

function table(req, name) {
  return getApp(req).datastore().table(name);
}

async function zcql(req, query) {
  const app = getApp(req);
  return app.zcql().executeZCQLQuery(query);
}

// ZCQL rows come back keyed by table name: [{ Facilities: {...} }, ...].
// Catalyst's ZCQL can return null/undefined (not []) for a zero-row match, so guard it here
// once rather than at every call site — narrowly-scoped queries hit this legitimately often.
function flatten(rows, tableName) {
  return (rows || []).map((r) => r[tableName]);
}

// Escapes a value for safe interpolation into a ZCQL string literal.
function esc(value) {
  return String(value).replace(/'/g, "''");
}

function q(value) {
  return `'${esc(value)}'`;
}

// Catalyst datetime columns expect 'YYYY-MM-DD HH:MM:SS' (no milliseconds), not ISO 8601.
function catalystDateTime(date = new Date()) {
  const [datePart, timePart] = date.toISOString().split('T');
  return `${datePart} ${timePart.split('.')[0]}`;
}

// 'State' is not an actual column in the live Facilities table — stripped defensively in
// case it's ever sent (kept even though the frontend type no longer includes it).
const READONLY_FIELDS = ['ROWID', 'CREATORID', 'CREATEDTIME', 'MODIFIEDTIME', 'State'];
function sanitizeInsert(body) {
  const clean = { ...(body || {}) };
  for (const field of READONLY_FIELDS) delete clean[field];
  return clean;
}

// Returns null (no restriction — State_Admin) or an array of facility ROWIDs the
// requesting user's role is scoped to see.
async function getScopedFacilityIds(req) {
  const role = req.user.role;
  if (role === 'State_Admin' || role === 'Auditor') return null;
  const FACILITY_SCOPED_ROLES = [
    'Facility_Staff', 'Pharmacist', 'Data_Entry_Clerk',
    'Facility_Head', 'Doctor', 'Staff_Nurse', 'ASHA_Worker', 'ANM',
    'Registration_Clerk', 'Store_Keeper', 'Facility_Supervisor',
    'Community_Health_Officer',
  ];
  if (FACILITY_SCOPED_ROLES.includes(role)) return [req.user.facility_id];

  let myFacility;
  try {
    myFacility = await table(req, TABLES.FACILITIES).getRow(req.user.facility_id);
  } catch (err) {
    return [req.user.facility_id]; // fallback: can't resolve jurisdiction, scope to just their own facility_id
  }

  let query = `SELECT ROWID FROM ${TABLES.FACILITIES} WHERE District = ${q(myFacility.District)}`;
  if (role === 'Block_Officer' && myFacility.Block) {
    query += ` AND Block = ${q(myFacility.Block)}`;
  }
  const rows = flatten(await zcql(req, query), TABLES.FACILITIES);
  return rows.map((r) => r.ROWID);
}

module.exports = {
  TABLES,
  getApp,
  table,
  zcql,
  flatten,
  esc,
  q,
  sanitizeInsert,
  catalystDateTime,
  getScopedFacilityIds,
};
