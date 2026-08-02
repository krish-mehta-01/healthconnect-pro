'use strict';

const express = require('express');
const { ok, fail } = require('../lib/response');
const { chat } = require('../lib/gemini');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message) return fail(res, 400, 'message is required');
    const reply = await chat(message, history);
    return ok(res, { reply });
  } catch (err) {
    return fail(res, 500, err.message || 'Chat request failed');
  }
});

module.exports = router;
