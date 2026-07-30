'use strict';

const jwt = require('jsonwebtoken');
const { fail } = require('../lib/response');

const COOKIE_NAME = 'hc_token';
const isProd = process.env.NODE_ENV === 'production';

function signToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: isProd ? 'None' : 'Lax' });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return fail(res, 401, 'Not authenticated');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return fail(res, 401, 'Session expired, please log in again');
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { COOKIE_NAME, signToken, setAuthCookie, clearAuthCookie, requireAuth, requireRole };
