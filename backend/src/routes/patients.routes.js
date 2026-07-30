'use strict';

const express = require('express');
const { table, zcql, flatten, q, sanitizeInsert, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const query = facility_id
      ? `SELECT * FROM ${TABLES.PATIENTS} WHERE Facility_ID = ${q(facility_id)}`
      : `SELECT * FROM ${TABLES.PATIENTS}`;
    const rows = flatten(await zcql(req, query), TABLES.PATIENTS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', async (req, res) => {
  try {
    const inserted = await table(req, TABLES.PATIENTS).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
