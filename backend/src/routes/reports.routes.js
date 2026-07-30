'use strict';

const express = require('express');
const { table, zcql, flatten, q, catalystDateTime, TABLES } = require('../lib/catalyst');
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

router.post('/submit', async (req, res) => {
  try {
    const { facility_id, cycle_id, indicators } = req.body || {};
    if (!facility_id || !Array.isArray(indicators)) {
      return fail(res, 400, 'facility_id and indicators are required');
    }

    const report = await table(req, TABLES.HEALTH_REPORTS).insertRow({
      Facility_ID: facility_id,
      Total_Score: computeTotalScore(indicators),
      Status: 'Draft',
      ...(cycle_id ? { Cycle_ID: cycle_id } : {}),
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

router.put('/:id/submit', async (req, res) => {
  try {
    const updated = await table(req, TABLES.HEALTH_REPORTS).updateRow({ ROWID: req.params.id, Status: 'Submitted' });
    await addHistory(req, req.params.id, 'Submitted for approval');
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/approve', requireRole('Block_Officer', 'District_Officer', 'State_Admin'), async (req, res) => {
  try {
    const { report_id, status, notes } = req.body || {};
    if (!report_id || !status) return fail(res, 400, 'report_id and status are required');
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
    const updated = await table(req, TABLES.HEALTH_REPORTS).updateRow({ ROWID: req.params.id, Status: status });
    await addHistory(req, req.params.id, status, comments);
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/:id/data', async (req, res) => {
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
