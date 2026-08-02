'use strict';

const express = require('express');
const { table, zcql, flatten, q, sanitizeInsert, getScopedFacilityIds, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    // This route is reachable pre-login (signup's facility picker), so req.user may be
    // undefined — only apply jurisdiction scoping when there's an authenticated user.
    let where = '';
    if (req.user) {
      const scopedIds = await getScopedFacilityIds(req);
      if (scopedIds !== null) {
        where = scopedIds.length ? ` WHERE ROWID IN (${scopedIds.map(q).join(',')})` : ' WHERE ROWID = -1';
      }
    }
    const rows = flatten(await zcql(req, `SELECT * FROM ${TABLES.FACILITIES}${where} ORDER BY Facility_Name ASC`), TABLES.FACILITIES);
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

router.post('/', requireAuth, requireRole('State_Admin'), async (req, res) => {
  try {
    const inserted = await table(req, TABLES.FACILITIES).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/:id', requireAuth, requireRole('State_Admin'), async (req, res) => {
  try {
    const updated = await table(req, TABLES.FACILITIES).updateRow({ ROWID: req.params.id, ...sanitizeInsert(req.body) });
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.delete('/:id', requireAuth, requireRole('State_Admin'), async (req, res) => {
  try {
    await table(req, TABLES.FACILITIES).deleteRow(req.params.id);
    return ok(res, null);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
