'use strict';

const express = require('express');
const { zcql, flatten, q, getScopedFacilityIds, TABLES } = require('../lib/catalyst');
const { ok, fail } = require('../lib/response');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const scopedIds = await getScopedFacilityIds(req);
    const facilitiesWhere = scopedIds === null
      ? ''
      : scopedIds.length ? ` WHERE ROWID IN (${scopedIds.map(q).join(',')})` : ' WHERE ROWID = -1';
    const facilityScopeWhere = scopedIds === null
      ? ''
      : scopedIds.length ? ` WHERE Facility_ID IN (${scopedIds.map(q).join(',')})` : ' WHERE ROWID = -1';

    const [facilities, reports, facilityInventory, inventoryMaster, urgentFeedback, patients, supplyRequests] = await Promise.all([
      flatten(await zcql(req, `SELECT * FROM ${TABLES.FACILITIES}${facilitiesWhere}`), TABLES.FACILITIES),
      flatten(await zcql(req, `SELECT * FROM ${TABLES.HEALTH_REPORTS}${facilityScopeWhere} ORDER BY CREATEDTIME DESC`), TABLES.HEALTH_REPORTS),
      flatten(await zcql(req, `SELECT * FROM ${TABLES.FACILITY_INVENTORY}${facilityScopeWhere}`), TABLES.FACILITY_INVENTORY),
      flatten(await zcql(req, `SELECT * FROM ${TABLES.INVENTORY_MASTER}`), TABLES.INVENTORY_MASTER),
      flatten(await zcql(req, `SELECT * FROM ${TABLES.SENTIMENT_TRIAGE} WHERE Urgency_Flag = true ORDER BY CREATEDTIME DESC LIMIT 10`), TABLES.SENTIMENT_TRIAGE),
      flatten(await zcql(req, `SELECT ROWID FROM ${TABLES.PATIENTS}${facilityScopeWhere}`), TABLES.PATIENTS),
      flatten(await zcql(req, `SELECT * FROM ${TABLES.SUPPLY_REQUESTS}${facilityScopeWhere}`), TABLES.SUPPLY_REQUESTS),
    ]);

    const thresholdByItem = new Map(inventoryMaster.map((m) => [m.ROWID, Number(m.Minimum_Threshold)]));
    const lowStockAlerts = facilityInventory.filter((fi) => {
      const threshold = thresholdByItem.get(fi.Item_ID);
      return threshold !== undefined && Number(fi.Current_Stock) < threshold;
    });

    const byStatus = (status) => reports.filter((r) => r.Status === status).length;

    const facilityNameById = new Map(facilities.map((f) => [f.ROWID, f.Facility_Name]));
    const scoresByFacility = new Map();
    for (const r of reports) {
      const score = Number(r.Total_Score);
      if (!Number.isFinite(score)) continue;
      const bucket = scoresByFacility.get(r.Facility_ID) || [];
      bucket.push(score);
      scoresByFacility.set(r.Facility_ID, bucket);
    }
    const facilityPerformance = Array.from(scoresByFacility.entries()).map(([facilityId, scores]) => ({
      name: facilityNameById.get(facilityId) || facilityId,
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));

    return ok(res, {
      totalFacilities: facilities.length,
      totalReports: reports.length,
      pendingReports: byStatus('Submitted'),
      approvedReports: byStatus('Approved'),
      rejectedReports: byStatus('Rejected'),
      draftReports: byStatus('Draft'),
      recentReports: reports.slice(0, 5),
      lowStockAlerts,
      urgentFeedback,
      facilityPerformance,
      totalPatients: patients.length,
      pendingSupplyRequests: supplyRequests.filter((r) => r.Status === 'Pending').length,
      totalInventoryItems: facilityInventory.length,
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
