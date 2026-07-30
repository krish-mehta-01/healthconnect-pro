'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { table, zcql, flatten, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function stripSecrets(row) {
  const { Password_Hash, ...rest } = row;
  return rest;
}

router.get('/me', (req, res) => ok(res, req.user));

router.get('/', requireRole('State_Admin', 'District_Officer', 'Block_Officer'), async (req, res) => {
  try {
    const rows = flatten(await zcql(req, `SELECT * FROM ${TABLES.USERS} ORDER BY CREATEDTIME DESC`), TABLES.USERS);
    return ok(res, rows.map(stripSecrets));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', requireRole('State_Admin'), async (req, res) => {
  try {
    const { name, email_id, role, facility_id, password } = req.body || {};
    if (!name || !email_id || !role || !facility_id) {
      return fail(res, 400, 'name, email_id, role and facility_id are required');
    }

    const passwordHash = await bcrypt.hash(password || Math.random().toString(36).slice(2), 10);
    const inserted = await table(req, TABLES.USERS).insertRow({
      Catalyst_Auth_ID: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      Role: role,
      Full_Name: name,
      email_id,
      Password_Hash: passwordHash,
      Facility_ID: facility_id,
    });
    return ok(res, stripSecrets(inserted));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
