'use strict';

const express = require('express');
const { table, zcql, flatten, q, sanitizeInsert, getScopedFacilityIds, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const clauses = [];
    if (facility_id) clauses.push(`Facility_ID = ${q(facility_id)}`);
    const scopedIds = await getScopedFacilityIds(req);
    if (scopedIds !== null) {
      clauses.push(scopedIds.length ? `Facility_ID IN (${scopedIds.map(q).join(',')})` : 'ROWID = -1');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const query = `SELECT * FROM ${TABLES.PATIENTS}${where}`;
    const rows = flatten(await zcql(req, query), TABLES.PATIENTS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Only the front-line roles that actually register patients — Doctor, Staff_Nurse,
// ASHA_Worker, ANM, Registration_Clerk, Community_Health_Officer (the HWC lead, who
// combines report-submission and patient-registration duty since an HWC is typically
// staffed by just one person). Facility_Head/Facility_Supervisor are read-only oversight
// roles; officers/State_Admin/Auditor/Pharmacist/Data_Entry_Clerk have no
// patient-registration duty at all.
router.post('/', requireRole('Doctor', 'Staff_Nurse', 'ASHA_Worker', 'ANM', 'Registration_Clerk', 'Community_Health_Officer'), async (req, res) => {
  try {
    // Force-scope every new patient to the registering user's own facility — these roles
    // are all single-facility-scoped, and the client never needs to (and shouldn't be
    // trusted to) supply Facility_ID itself.
    const inserted = await table(req, TABLES.PATIENTS).insertRow({
      ...sanitizeInsert(req.body),
      Facility_ID: req.user.facility_id,
    });
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Only Staff_Nurse maintains existing patient records over time — every other
// patient-registering role can only create new ones, never edit.
router.put('/:id', requireRole('Staff_Nurse'), async (req, res) => {
  try {
    const scopedIds = await getScopedFacilityIds(req);
    const existing = await table(req, TABLES.PATIENTS).getRow(req.params.id);
    if (scopedIds !== null && !scopedIds.includes(existing.Facility_ID)) {
      return fail(res, 403, 'You do not have access to this patient record');
    }
    const { Facility_ID, ...safeBody } = sanitizeInsert(req.body);
    const updated = await table(req, TABLES.PATIENTS).updateRow({
      ROWID: req.params.id,
      ...safeBody,
    });
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
