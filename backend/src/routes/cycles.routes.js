'use strict';

const express = require('express');
const { table, zcql, flatten, sanitizeInsert, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = flatten(await zcql(req, `SELECT * FROM ${TABLES.REPORTING_CYCLES} ORDER BY CREATEDTIME DESC`), TABLES.REPORTING_CYCLES);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', requireRole('State_Admin'), async (req, res) => {
  try {
    const inserted = await table(req, TABLES.REPORTING_CYCLES).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
