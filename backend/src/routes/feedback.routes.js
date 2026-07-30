'use strict';

const express = require('express');
const { table, zcql, flatten, q, catalystDateTime, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { analyzeSentiment } = require('../lib/gemini');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const query = facility_id
      ? `SELECT * FROM ${TABLES.FEEDBACK_LOGS} WHERE Facility_ID = ${q(facility_id)} ORDER BY CREATEDTIME DESC`
      : `SELECT * FROM ${TABLES.FEEDBACK_LOGS} ORDER BY CREATEDTIME DESC`;
    const rows = flatten(await zcql(req, query), TABLES.FEEDBACK_LOGS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', async (req, res) => {
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
