'use strict';

const express = require('express');
const { table, zcql, flatten, q, catalystDateTime, getScopedFacilityIds, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

async function addHistory(req, reportId, statusChange, comments) {
  await table(req, TABLES.WORKFLOW_HISTORY).insertRow({
    Report_ID: reportId,
    Action_By: req.user.db_user_id,
    Status_Change: statusChange,
    Action_Timestamp: catalystDateTime(),
    ...(comments ? { Comments: comments } : {}),
  });
}

async function resolveActionByNames(req, history) {
  const ids = [...new Set(history.map((h) => h.Action_By).filter(Boolean))];
  if (ids.length === 0) return history;
  const users = flatten(
    await zcql(req, `SELECT ROWID, Full_Name FROM ${TABLES.USERS} WHERE ROWID IN (${ids.map(q).join(',')})`),
    TABLES.USERS
  );
  const nameById = new Map(users.map((u) => [u.ROWID, u.Full_Name]));
  return history.map((h) => ({ ...h, Action_By: nameById.get(h.Action_By) || h.Action_By }));
}

function computeTotalScore(indicators) {
  const sum = indicators.reduce((acc, i) => {
    const n = Number(i.value);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  return String(sum);
}

router.get('/', async (req, res) => {
  try {
    const { facility_id, status, cycle_id } = req.query;
    const clauses = [];
    if (facility_id) clauses.push(`Facility_ID = ${q(facility_id)}`);
    if (status) clauses.push(`Status = ${q(status)}`);
    if (cycle_id) clauses.push(`Cycle_ID = ${q(cycle_id)}`);
    const scopedIds = await getScopedFacilityIds(req);
    if (scopedIds !== null) {
      clauses.push(scopedIds.length ? `Facility_ID IN (${scopedIds.map(q).join(',')})` : 'ROWID = -1');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.HEALTH_REPORTS}${where} ORDER BY CREATEDTIME DESC`),
      TABLES.HEALTH_REPORTS
    );
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// System-wide activity log across every report's WorkflowHistory — Auditor's read-only
// oversight view and State_Admin. Must be registered before the '/:id' route below so
// Express doesn't match this literal path as an :id param.
router.get('/activity-log', requireRole('Auditor', 'State_Admin'), async (req, res) => {
  try {
    const rawHistory = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.WORKFLOW_HISTORY} ORDER BY Action_Timestamp DESC LIMIT 100`),
      TABLES.WORKFLOW_HISTORY
    );
    const history = await resolveActionByNames(req, rawHistory);

    const reportIds = [...new Set(history.map((h) => h.Report_ID).filter(Boolean))];
    let facilityByReportId = new Map();
    if (reportIds.length) {
      const reports = flatten(
        await zcql(req, `SELECT ROWID, Facility_ID FROM ${TABLES.HEALTH_REPORTS} WHERE ROWID IN (${reportIds.map(q).join(',')})`),
        TABLES.HEALTH_REPORTS
      );
      facilityByReportId = new Map(reports.map((r) => [r.ROWID, r.Facility_ID]));
    }

    const enriched = history.map((h) => ({ ...h, Facility_ID: facilityByReportId.get(h.Report_ID) || null }));
    return ok(res, enriched);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Facilities with no HealthReports row in the currently Active reporting cycle, scoped to
// the caller's jurisdiction. Also must be registered before '/:id'.
router.get('/overdue', requireRole('District_Officer', 'Block_Officer', 'State_Admin'), async (req, res) => {
  try {
    const activeCycles = flatten(
      await zcql(req, `SELECT ROWID FROM ${TABLES.REPORTING_CYCLES} WHERE Status = ${q('Active')}`),
      TABLES.REPORTING_CYCLES
    );
    if (!activeCycles.length) return ok(res, []);
    const cycleId = activeCycles[0].ROWID;

    const scopedIds = await getScopedFacilityIds(req);
    let facilities;
    if (scopedIds === null) {
      // Unrestricted (State_Admin) — full facility list.
      facilities = flatten(
        await zcql(req, `SELECT ROWID, Facility_Name, District, Block FROM ${TABLES.FACILITIES}`),
        TABLES.FACILITIES
      );
    } else if (!scopedIds.length) {
      return ok(res, []);
    } else {
      facilities = flatten(
        await zcql(req, `SELECT ROWID, Facility_Name, District, Block FROM ${TABLES.FACILITIES} WHERE ROWID IN (${scopedIds.map(q).join(',')})`),
        TABLES.FACILITIES
      );
    }

    let reportQuery = `SELECT Facility_ID FROM ${TABLES.HEALTH_REPORTS} WHERE Cycle_ID = ${q(cycleId)}`;
    if (scopedIds !== null) {
      reportQuery += ` AND Facility_ID IN (${scopedIds.map(q).join(',')})`;
    }
    const reportRows = flatten(await zcql(req, reportQuery), TABLES.HEALTH_REPORTS);
    const reportedFacilityIds = new Set(reportRows.map((r) => r.Facility_ID));

    const overdue = facilities
      .filter((f) => !reportedFacilityIds.has(f.ROWID))
      .map((f) => ({ Facility_ID: f.ROWID, Facility_Name: f.Facility_Name, District: f.District, Block: f.Block }));

    return ok(res, overdue);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const report = await table(req, TABLES.HEALTH_REPORTS).getRow(id);
    const indicators = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.REPORT_DATA} WHERE Report_ID = ${q(id)}`),
      TABLES.REPORT_DATA
    );
    const rawHistory = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.WORKFLOW_HISTORY} WHERE Report_ID = ${q(id)} ORDER BY Action_Timestamp ASC`),
      TABLES.WORKFLOW_HISTORY
    );
    const history = await resolveActionByNames(req, rawHistory);
    return ok(res, { ...report, indicators, history });
  } catch (err) {
    return fail(res, 404, 'Report not found');
  }
});

router.post('/submit', requireRole('Facility_Staff', 'Data_Entry_Clerk'), async (req, res) => {
  try {
    const { facility_id, cycle_id, indicators } = req.body || {};
    if (!facility_id || !cycle_id || !Array.isArray(indicators)) {
      return fail(res, 400, 'facility_id, cycle_id and indicators are required');
    }

    const report = await table(req, TABLES.HEALTH_REPORTS).insertRow({
      Facility_ID: facility_id,
      Cycle_ID: cycle_id,
      Total_Score: computeTotalScore(indicators),
      Status: 'Draft',
    });

    for (const ind of indicators) {
      await table(req, TABLES.REPORT_DATA).insertRow({
        Report_ID: report.ROWID,
        Indicator_ID: ind.indicator_id,
        Metric_Value: String(ind.value),
        Notes: ind.notes || '',
      });
    }

    await addHistory(req, report.ROWID, 'Draft created');
    return ok(res, report);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/:id/submit', requireRole('Facility_Staff', 'Data_Entry_Clerk'), async (req, res) => {
  try {
    const updated = await table(req, TABLES.HEALTH_REPORTS).updateRow({ ROWID: req.params.id, Status: 'Submitted' });
    await addHistory(req, req.params.id, 'Submitted for approval');
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Hard gate (per the approved workflow plan): if a report's facility has a Facility_Head
// user assigned, the report must be Endorsed — not just Submitted — before an officer can
// approve/reject it. Facilities with no Facility_Head yet keep the original Submitted
// fallback, so onboarding a new facility can't deadlock the whole network's reporting.
async function assertApprovable(req, reportId) {
  const report = await table(req, TABLES.HEALTH_REPORTS).getRow(reportId);
  const facilityHeads = flatten(
    await zcql(req, `SELECT ROWID FROM ${TABLES.USERS} WHERE Facility_ID = ${q(report.Facility_ID)} AND Role = ${q('Facility_Head')}`),
    TABLES.USERS
  );
  const hasFacilityHead = facilityHeads.length > 0;
  const requiredStatus = hasFacilityHead ? 'Endorsed' : 'Submitted';
  if (report.Status !== requiredStatus) {
    const reason = hasFacilityHead
      ? `This facility has a Facility Head — the report must be Endorsed before it can be approved or rejected (current status: ${report.Status}).`
      : `Report must be Submitted before it can be approved or rejected (current status: ${report.Status}).`;
    return { ok: false, reason };
  }
  return { ok: true, report };
}

router.post('/:id/endorse', requireRole('Facility_Head'), async (req, res) => {
  try {
    const report = await table(req, TABLES.HEALTH_REPORTS).getRow(req.params.id);
    if (report.Facility_ID !== req.user.facility_id) {
      return fail(res, 403, 'You can only endorse reports for your own facility');
    }
    if (report.Status !== 'Submitted') {
      return fail(res, 400, `Report must be Submitted before it can be endorsed (current status: ${report.Status})`);
    }
    const updated = await table(req, TABLES.HEALTH_REPORTS).updateRow({ ROWID: req.params.id, Status: 'Endorsed' });
    await addHistory(req, req.params.id, 'Endorsed', req.body?.comments);
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/approve', requireRole('Block_Officer', 'District_Officer', 'State_Admin'), async (req, res) => {
  try {
    const { report_id, status, notes } = req.body || {};
    if (!report_id || !status) return fail(res, 400, 'report_id and status are required');
    const gate = await assertApprovable(req, report_id);
    if (!gate.ok) return fail(res, 409, gate.reason);
    const updated = await table(req, TABLES.HEALTH_REPORTS).updateRow({ ROWID: report_id, Status: status });
    await addHistory(req, report_id, status, notes);
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/approve', requireRole('Block_Officer', 'District_Officer', 'State_Admin'), async (req, res) => {
  try {
    const { status, comments } = req.body || {};
    if (!status) return fail(res, 400, 'status is required');
    const gate = await assertApprovable(req, req.params.id);
    if (!gate.ok) return fail(res, 409, gate.reason);
    const updated = await table(req, TABLES.HEALTH_REPORTS).updateRow({ ROWID: req.params.id, Status: status });
    await addHistory(req, req.params.id, status, comments);
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/:id/data', requireRole('Facility_Staff', 'Data_Entry_Clerk'), async (req, res) => {
  try {
    const { indicators } = req.body || {};
    if (!Array.isArray(indicators)) return fail(res, 400, 'indicators array is required');

    const results = [];
    for (const ind of indicators) {
      if (ind.ROWID) {
        results.push(await table(req, TABLES.REPORT_DATA).updateRow({
          ROWID: ind.ROWID, Metric_Value: String(ind.value), Notes: ind.notes || '',
        }));
      } else {
        results.push(await table(req, TABLES.REPORT_DATA).insertRow({
          Report_ID: req.params.id, Indicator_ID: ind.indicator_id, Metric_Value: String(ind.value), Notes: ind.notes || '',
        }));
      }
    }
    return ok(res, results);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
