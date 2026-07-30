'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { table, zcql, flatten, q, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();

function toCurrentUser(userRow) {
  return {
    user_id: userRow.ROWID,
    role: userRow.Role,
    facility_id: userRow.Facility_ID || null,
    db_user_id: userRow.ROWID,
    name: userRow.Full_Name,
    email_id: userRow.email_id,
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role, facilityId } = req.body || {};
    if (!email || !password || !name || !role || !facilityId) {
      return fail(res, 400, 'email, password, name, role and facilityId are required');
    }

    const existing = flatten(
      await zcql(req, `SELECT ROWID FROM ${TABLES.USERS} WHERE email_id = ${q(email)}`),
      TABLES.USERS
    );
    if (existing.length > 0) return fail(res, 409, 'An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const authId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const inserted = await table(req, TABLES.USERS).insertRow({
      Catalyst_Auth_ID: authId,
      Role: role,
      Full_Name: name,
      email_id: email,
      Password_Hash: passwordHash,
      Facility_ID: facilityId,
    });

    const currentUser = toCurrentUser(inserted);
    setAuthCookie(res, currentUser);
    return ok(res, currentUser);
  } catch (err) {
    return fail(res, 500, err.message || 'Signup failed');
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'email and password are required');

    const rows = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.USERS} WHERE email_id = ${q(email)} LIMIT 1`),
      TABLES.USERS
    );
    const userRow = rows[0];
    if (!userRow || !userRow.Password_Hash) return fail(res, 401, 'Invalid email or password');

    const valid = await bcrypt.compare(password, userRow.Password_Hash);
    if (!valid) return fail(res, 401, 'Invalid email or password');

    const currentUser = toCurrentUser(userRow);
    setAuthCookie(res, currentUser);
    return ok(res, currentUser);
  } catch (err) {
    return fail(res, 500, err.message || 'Login failed');
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return ok(res, { loggedOut: true });
});

module.exports = router;
