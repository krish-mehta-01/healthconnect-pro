'use strict';

const express = require('express');
const { table, zcql, flatten, q, sanitizeInsert, catalystDateTime, getScopedFacilityIds, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/master', async (req, res) => {
  try {
    const rows = flatten(await zcql(req, `SELECT * FROM ${TABLES.INVENTORY_MASTER} ORDER BY Item_Name ASC`), TABLES.INVENTORY_MASTER);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/master', requireRole('State_Admin'), async (req, res) => {
  try {
    const inserted = await table(req, TABLES.INVENTORY_MASTER).insertRow(sanitizeInsert(req.body));
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Store_Keeper's category scope — everything except Medicines, which stays exclusively
// Pharmacist's domain (see the role hierarchy table). Live Inventory_Master data uses
// "Medicines" as the pharmaceutical category (confirmed against the seeded rows), not
// "Pharmaceuticals" — matching the real category string here, not a guessed label, is
// load-bearing for this gate to actually restrict anything.
const PHARMA_CATEGORY = 'Medicines';

router.get('/facility', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const clauses = [];
    if (facility_id) clauses.push(`Facility_ID = ${q(facility_id)}`);
    const scopedIds = await getScopedFacilityIds(req);
    if (scopedIds !== null) {
      clauses.push(scopedIds.length ? `Facility_ID IN (${scopedIds.map(q).join(',')})` : 'ROWID = -1');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const query = `SELECT * FROM ${TABLES.FACILITY_INVENTORY}${where}`;
    let rows = flatten(await zcql(req, query), TABLES.FACILITY_INVENTORY);

    if (req.user.role === 'Store_Keeper') {
      const masterRows = flatten(await zcql(req, `SELECT * FROM ${TABLES.INVENTORY_MASTER}`), TABLES.INVENTORY_MASTER);
      const categoryByItem = new Map(masterRows.map((m) => [m.ROWID, m.Category]));
      rows = rows.filter((r) => categoryByItem.get(r.Item_ID) !== PHARMA_CATEGORY);
    }

    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Stock-level updates are an operational inventory action, not exposed to Data_Entry_Clerk
// (who has no inventory access at all per the permission matrix) or to Auditor (blocked
// globally from writes already). Store_Keeper is additionally restricted below to
// non-pharmaceutical items only.
router.put('/facility/:id', requireRole('State_Admin', 'District_Officer', 'Block_Officer', 'Facility_Staff', 'Pharmacist', 'Store_Keeper'), async (req, res) => {
  try {
    const { Current_Stock } = req.body || {};

    if (req.user.role === 'Store_Keeper') {
      const existing = await table(req, TABLES.FACILITY_INVENTORY).getRow(req.params.id);
      const master = await table(req, TABLES.INVENTORY_MASTER).getRow(existing.Item_ID);
      if (master.Category === PHARMA_CATEGORY) {
        return fail(res, 403, 'Store_Keeper cannot manage pharmaceutical stock');
      }
    }

    const updated = await table(req, TABLES.FACILITY_INVENTORY).updateRow({
      ROWID: req.params.id, Current_Stock: Current_Stock, Last_Updated: catalystDateTime(),
    });

    const master = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.INVENTORY_MASTER} WHERE ROWID = ${q(updated.Item_ID)}`),
      TABLES.INVENTORY_MASTER
    )[0];

    if (master && Number(Current_Stock) < Number(master.Minimum_Threshold)) {
      return ok(res, updated, {
        alert: { type: 'low_stock', item: master.Item_Name, current: Number(Current_Stock), threshold: Number(master.Minimum_Threshold) },
      });
    }
    return ok(res, updated);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/requests', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const clauses = [];
    if (facility_id) clauses.push(`Facility_ID = ${q(facility_id)}`);
    const scopedIds = await getScopedFacilityIds(req);
    if (scopedIds !== null) {
      clauses.push(scopedIds.length ? `Facility_ID IN (${scopedIds.map(q).join(',')})` : 'ROWID = -1');
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const query = `SELECT * FROM ${TABLES.SUPPLY_REQUESTS}${where} ORDER BY CREATEDTIME DESC`;
    const rows = flatten(await zcql(req, query), TABLES.SUPPLY_REQUESTS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Facility_Staff and Pharmacist raise general supply requests; ANM covers basic
// sub-center stock; Store_Keeper covers non-pharmaceutical facility stock (checked below).
router.post('/requests', requireRole('Facility_Staff', 'Pharmacist', 'ANM', 'Store_Keeper'), async (req, res) => {
  try {
    if (req.user.role === 'Store_Keeper' && req.body?.Item_ID) {
      const master = await table(req, TABLES.INVENTORY_MASTER).getRow(req.body.Item_ID);
      if (master.Category === PHARMA_CATEGORY) {
        return fail(res, 403, 'Store_Keeper cannot request pharmaceutical stock');
      }
    }

    const inserted = await table(req, TABLES.SUPPLY_REQUESTS).insertRow({
      ...sanitizeInsert(req.body),
      Status: 'Pending',
    });
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Re-routing resources between facilities is an officer/admin coordination action.
router.post('/re-route', requireRole('State_Admin', 'District_Officer', 'Block_Officer'), async (req, res) => {
  try {
    const { origin_facility_id, destination_facility_id, item_id, quantity, request_id } = req.body || {};
    if (!origin_facility_id || !destination_facility_id || !item_id || !quantity) {
      return fail(res, 400, 'origin_facility_id, destination_facility_id, item_id and quantity are required');
    }

    const originRow = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.FACILITY_INVENTORY} WHERE Facility_ID = ${q(origin_facility_id)} AND Item_ID = ${q(item_id)}`),
      TABLES.FACILITY_INVENTORY
    )[0];
    if (!originRow || Number(originRow.Current_Stock) < Number(quantity)) {
      return fail(res, 400, 'Origin facility does not have enough stock for this transfer');
    }
    await table(req, TABLES.FACILITY_INVENTORY).updateRow({
      ROWID: originRow.ROWID,
      Current_Stock: Number(originRow.Current_Stock) - Number(quantity),
      Last_Updated: catalystDateTime(),
    });

    const destRow = flatten(
      await zcql(req, `SELECT * FROM ${TABLES.FACILITY_INVENTORY} WHERE Facility_ID = ${q(destination_facility_id)} AND Item_ID = ${q(item_id)}`),
      TABLES.FACILITY_INVENTORY
    )[0];
    if (destRow) {
      await table(req, TABLES.FACILITY_INVENTORY).updateRow({
        ROWID: destRow.ROWID,
        Current_Stock: Number(destRow.Current_Stock) + Number(quantity),
        Last_Updated: catalystDateTime(),
      });
    } else {
      await table(req, TABLES.FACILITY_INVENTORY).insertRow({
        Facility_ID: destination_facility_id,
        Item_ID: item_id,
        Current_Stock: Number(quantity),
        Last_Updated: catalystDateTime(),
      });
    }

    if (request_id) {
      await table(req, TABLES.SUPPLY_REQUESTS).updateRow({ ROWID: request_id, Status: 'Dispatched' });
    }

    return ok(res, { message: 'Resources re-routed successfully' });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
