'use strict';

const express = require('express');
const { table, zcql, flatten, sanitizeInsert, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rows = flatten(await zcql(req, `SELECT * FROM ${TABLES.FACILITIES} ORDER BY Facility_Name ASC`), TABLES.FACILITIES);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await table(req, TABLES.FACILITIES).getRow(req.params.id);
    return ok(res, row);
  } catch (err) {
    return fail(res, 404, 'Facility not found');
  }
});

router.post('/', requireRole('State_Admin'), async (req, res) => {
  try {
    const inserted = await table(req, TABLES.FACILITIES).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/:id', requireRole('State_Admin'), async (req, res) => {
  try {
    const updated = await table(req, TABLES.FACILITIES).updateRow({ ROWID: req.params.id, ...sanitizeInsert(req.body) });
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.delete('/:id', requireRole('State_Admin'), async (req, res) => {
  try {
    await table(req, TABLES.FACILITIES).deleteRow(req.params.id);
    return ok(res, null);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
