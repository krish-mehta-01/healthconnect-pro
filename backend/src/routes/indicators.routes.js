'use strict';

const express = require('express');
const { table, zcql, flatten, q, sanitizeInsert, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const deptId = req.query.dept_id;
    const query = deptId
      ? `SELECT * FROM ${TABLES.INDICATORS} WHERE Dept_ID = ${q(deptId)} ORDER BY Indicator_Name ASC`
      : `SELECT * FROM ${TABLES.INDICATORS} ORDER BY Indicator_Name ASC`;
    const rows = flatten(await zcql(req, query), TABLES.INDICATORS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', requireRole('State_Admin'), async (req, res) => {
  try {
    const inserted = await table(req, TABLES.INDICATORS).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
