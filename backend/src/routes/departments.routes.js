'use strict';

const express = require('express');
const { table, zcql, flatten, sanitizeInsert, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = flatten(await zcql(req, `SELECT * FROM ${TABLES.DEPARTMENTS} ORDER BY Dept_Name ASC`), TABLES.DEPARTMENTS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', requireRole('State_Admin'), async (req, res) => {
  try {
    const inserted = await table(req, TABLES.DEPARTMENTS).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
