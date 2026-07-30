'use strict';

const express = require('express');
const { zcql, flatten, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');

const router = express.Router();

router.get('/escalated', async (req, res) => {
  try {
    const triageRows = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.SENTIMENT_TRIAGE} WHERE Urgency_Flag = true ORDER BY CREATEDTIME DESC`),
      TABLES.SENTIMENT_TRIAGE
    );
    if (triageRows.length === 0) return ok(res, []);

    const feedbackRows = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.FEEDBACK_LOGS} ORDER BY CREATEDTIME DESC`),
      TABLES.FEEDBACK_LOGS
    );
    const feedbackById = new Map(feedbackRows.map((f) => [f.ROWID, f]));

    const escalated = triageRows
      .map((t) => {
        const fb = feedbackById.get(t.Feedback_ID);
        if (!fb) return null;
        return { ...fb, Sentiment_Score: t.Sentiment_Score, Urgency_Flag: t.Urgency_Flag };
      })
      .filter(Boolean);

    return ok(res, escalated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
