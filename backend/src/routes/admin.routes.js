'use strict';

const express = require('express');
const { table, zcql, flatten, catalystDateTime, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');

const router = express.Router();

function requireSeedSecret(req, res, next) {
  const provided = req.headers['x-seed-secret'];
  if (!process.env.SEED_SECRET || provided !== process.env.SEED_SECRET) {
    return fail(res, 403, 'Forbidden');
  }
  next();
}

router.post('/test-insert', requireSeedSecret, async (req, res) => {
  try {
    const { tableName, payload } = req.body || {};
    const inserted = await table(req, tableName).insertRow(payload);
    return ok(res, inserted);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
      code: err.code,
      value: err.value,
      statusCode: err.statusCode,
    });
  }
});

router.post('/test-delete', requireSeedSecret, async (req, res) => {
  try {
    const { tableName, rowId } = req.body || {};
    await table(req, tableName).deleteRow(rowId);
    return ok(res, { deleted: rowId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

router.get('/list', requireSeedSecret, async (req, res) => {
  try {
    const tableName = req.query.table;
    const rows = flatten(await zcql(req, `SELECT * FROM ${tableName}`), tableName);
    return ok(res, rows);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

router.post('/wipe', requireSeedSecret, async (req, res) => {
  try {
    const { tableName, keepRowIds } = req.body || {};
    const keep = new Set(keepRowIds || []);
    const rows = flatten(await zcql(req, `SELECT * FROM ${tableName}`), tableName);
    const deleted = [];
    for (const row of rows) {
      if (keep.has(row.ROWID)) continue;
      await table(req, tableName).deleteRow(row.ROWID);
      deleted.push(row.ROWID);
    }
    return ok(res, { deleted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

// Fills only the tables that were still empty, using the real pre-existing
// Facilities/Cycles/Indicators/Inventory_Master/HealthReports/Users rows
// (this project's Data Store already had a baseline dataset before this backend existed).
router.post('/seed', requireSeedSecret, async (req, res) => {
  try {
    const t = (name) => table(req, name);
    const now = () => catalystDateTime();

    const IGMC = '59526000000027011';
    const THEOG = '59526000000022517';
    const MASHOBRA = '59526000000036009';

    const OXYGEN_CYL = '59526000000032013';
    const THERMAL_BLANKET = '59526000000035011';
    const IV_FLUID = '59526000000033012';

    const REPORT_APPROVED_1 = '59526000000025007';
    const REPORT_APPROVED_2 = '59526000000026008';
    const REPORT_DRAFT = '59526000000027012';

    const DISTRICT_OFFICER = '59526000000034009';
    const BLOCK_OFFICER = '59526000000032012';
    const FACILITY_STAFF = '59526000000035010';

    const patients = await Promise.all([
      t(TABLES.PATIENTS).insertRow({ Patient_Name: 'Rakesh Verma', Age: '54', Gender: 'Male', Facility_ID: IGMC }),
      t(TABLES.PATIENTS).insertRow({ Patient_Name: 'Sunita Chauhan', Age: '32', Gender: 'Female', Facility_ID: THEOG }),
      t(TABLES.PATIENTS).insertRow({ Patient_Name: 'Anil Thakur', Age: '67', Gender: 'Male', Facility_ID: MASHOBRA }),
    ]);
    const [pat1, pat2, pat3] = patients;

    const supplyRequests = await Promise.all([
      t(TABLES.SUPPLY_REQUESTS).insertRow({ Facility_ID: MASHOBRA, Item_ID: OXYGEN_CYL, Quantity_Requested: 5, Status: 'Pending' }),
      t(TABLES.SUPPLY_REQUESTS).insertRow({ Facility_ID: THEOG, Item_ID: THERMAL_BLANKET, Quantity_Requested: 15, Status: 'Pending' }),
    ]);

    const history = await Promise.all([
      t(TABLES.WORKFLOW_HISTORY).insertRow({ Report_ID: REPORT_APPROVED_1, Action_By: FACILITY_STAFF, Status_Change: 'Draft created', Action_Timestamp: now() }),
      t(TABLES.WORKFLOW_HISTORY).insertRow({ Report_ID: REPORT_APPROVED_1, Action_By: DISTRICT_OFFICER, Status_Change: 'Approved', Comments: 'Looks good', Action_Timestamp: now() }),
      t(TABLES.WORKFLOW_HISTORY).insertRow({ Report_ID: REPORT_APPROVED_2, Action_By: FACILITY_STAFF, Status_Change: 'Draft created', Action_Timestamp: now() }),
      t(TABLES.WORKFLOW_HISTORY).insertRow({ Report_ID: REPORT_APPROVED_2, Action_By: BLOCK_OFFICER, Status_Change: 'Approved', Action_Timestamp: now() }),
      t(TABLES.WORKFLOW_HISTORY).insertRow({ Report_ID: REPORT_DRAFT, Action_By: FACILITY_STAFF, Status_Change: 'Draft created', Action_Timestamp: now() }),
    ]);

    const feedback1 = await t(TABLES.FEEDBACK_LOGS).insertRow({ Facility_ID: MASHOBRA, Patient_ID: pat3.ROWID, Feedback_Text: 'No oxygen available when my father needed it urgently — this is dangerous and unacceptable.', Created_Date: now() });
    const feedback2 = await t(TABLES.FEEDBACK_LOGS).insertRow({ Facility_ID: IGMC, Patient_ID: pat1.ROWID, Feedback_Text: 'The staff was very helpful and the ward was clean. Thank you.', Created_Date: now() });
    const feedback3 = await t(TABLES.FEEDBACK_LOGS).insertRow({ Facility_ID: THEOG, Patient_ID: pat2.ROWID, Feedback_Text: 'Waiting time was long but the doctor was thorough.', Created_Date: now() });

    const sentiment = await Promise.all([
      t(TABLES.SENTIMENT_TRIAGE).insertRow({ Feedback_ID: feedback1.ROWID, Sentiment_Score: '-0.85', Urgency_Flag: true }),
      t(TABLES.SENTIMENT_TRIAGE).insertRow({ Feedback_ID: feedback2.ROWID, Sentiment_Score: '0.7', Urgency_Flag: false }),
      t(TABLES.SENTIMENT_TRIAGE).insertRow({ Feedback_ID: feedback3.ROWID, Sentiment_Score: '-0.1', Urgency_Flag: false }),
    ]);

    return ok(res, {
      patients: patients.map((p) => p.ROWID),
      supplyRequests: supplyRequests.map((r) => r.ROWID),
      history: history.map((h) => h.ROWID),
      feedback: [feedback1.ROWID, feedback2.ROWID, feedback3.ROWID],
      sentiment: sentiment.map((s) => s.ROWID),
      message: 'Seed complete',
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
