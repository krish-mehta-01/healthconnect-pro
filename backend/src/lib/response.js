'use strict';

function ok(res, data, extra) {
  return res.json({ success: true, data, ...(extra || {}) });
}

function fail(res, status, error) {
  return res.status(status).json({ success: false, error });
}

module.exports = { ok, fail };
