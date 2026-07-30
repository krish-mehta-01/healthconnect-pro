'use strict';

const express = require('express');
const { extractFromImage } = require('../lib/gemini');
const { ok, fail } = require('../lib/response');

const router = express.Router();

router.post('/extract', async (req, res) => {
  try {
    const { image_base64, mime_type } = req.body || {};
    if (!image_base64) return fail(res, 400, 'image_base64 is required');
    const result = await extractFromImage(image_base64, mime_type);
    return ok(res, result);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;
