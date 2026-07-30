'use strict';

const express = require('express');
const { table, zcql, flatten, q, sanitizeInsert, catalystDateTime, TABLES } = require('../lib/catalyst');
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

router.get('/facility', async (req, res) => {
  try {
    const { facility_id } = req.query;
    const query = facility_id
      ? `SELECT * FROM ${TABLES.FACILITY_INVENTORY} WHERE Facility_ID = ${q(facility_id)}`
      : `SELECT * FROM ${TABLES.FACILITY_INVENTORY}`;
    const rows = flatten(await zcql(req, query), TABLES.FACILITY_INVENTORY);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/facility/:id', async (req, res) => {
  try {
    const { Current_Stock } = req.body || {};
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
    const query = facility_id
      ? `SELECT * FROM ${TABLES.SUPPLY_REQUESTS} WHERE Facility_ID = ${q(facility_id)} ORDER BY CREATEDTIME DESC`
      : `SELECT * FROM ${TABLES.SUPPLY_REQUESTS} ORDER BY CREATEDTIME DESC`;
    const rows = flatten(await zcql(req, query), TABLES.SUPPLY_REQUESTS);
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/requests', async (req, res) => {
  try {
    const inserted = await table(req, TABLES.SUPPLY_REQUESTS).insertRow({
      ...sanitizeInsert(req.body),
      Status: 'Pending',
    });
    return ok(res, inserted);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/re-route', async (req, res) => {
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
