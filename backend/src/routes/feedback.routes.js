'use strict';

const express = require('express');
const { table, zcql, flatten, q, catalystDateTime, getScopedFacilityIds, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { analyzeSentiment } = require('../lib/gemini');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const clauses = [];
    if (facility_id) clauses.push(`Facility_ID = ${q(facility_id)}`);
    const scopedIds = await getScopedFacilityIds(req);
    if (scopedIds !== null) {
      clauses.push(scopedIds.length ? `Facility_ID IN (${scopedIds.map(q).join(',')})` : 'ROWID = -1');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const query = `SELECT * FROM ${TABLES.FEEDBACK_LOGS}${where} ORDER BY CREATEDTIME DESC`;
    const rows = flatten(await zcql(req, query), TABLES.FEEDBACK_LOGS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Facility_Staff, ASHA_Worker and Staff_Nurse log patient feedback — every other role
// (including officers and State_Admin) is a review/oversight role for feedback, not a
// source of it.
router.post('/', requireRole('Facility_Staff', 'ASHA_Worker', 'Staff_Nurse'), async (req, res) => {
  try {
    const { Facility_ID, Patient_ID, Feedback_Text } = req.body || {};
    if (!Facility_ID || !Patient_ID || !Feedback_Text) {
      return fail(res, 400, 'Facility_ID, Patient_ID and Feedback_Text are required');
    }

    const feedback = await table(req, TABLES.FEEDBACK_LOGS).insertRow({
      Facility_ID,
      Patient_ID,
      Feedback_Text,
      Created_Date: catalystDateTime(),
    });

    const { score, urgency } = await analyzeSentiment(Feedback_Text);
    const sentiment = await table(req, TABLES.SENTIMENT_TRIAGE).insertRow({
      Feedback_ID: feedback.ROWID,
      Sentiment_Score: String(score),
      Urgency_Flag: urgency === 'High',
    });

    return ok(res, { feedback, sentiment });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { feedback_text } = req.body || {};
    if (!feedback_text) return fail(res, 400, 'feedback_text is required');
    const result = await analyzeSentiment(feedback_text);
    return ok(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
