'use strict';

const express = require('express');
const { zcql, flatten, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.SENTIMENT_TRIAGE} ORDER BY CREATEDTIME DESC`),
      TABLES.SENTIMENT_TRIAGE
    );
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
