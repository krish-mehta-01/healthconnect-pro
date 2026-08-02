'use strict';

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./src/middleware/auth');

const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const facilitiesRoutes = require('./src/routes/facilities.routes');
const departmentsRoutes = require('./src/routes/departments.routes');
const cyclesRoutes = require('./src/routes/cycles.routes');
const indicatorsRoutes = require('./src/routes/indicators.routes');
const reportsRoutes = require('./src/routes/reports.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const feedbackRoutes = require('./src/routes/feedback.routes');
const triageRoutes = require('./src/routes/triage.routes');
const grievancesRoutes = require('./src/routes/grievances.routes');
const patientsRoutes = require('./src/routes/patients.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const ocrRoutes = require('./src/routes/ocr.routes');
const chatRoutes = require('./src/routes/chat.routes');

const app = express();

// No app-level CORS middleware: Catalyst's AppSail gateway already sends
// Access-Control-Allow-Origin/Credentials/Methods/Headers for every request.
// Adding our own here duplicates the header, which browsers reject outright.
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => res.status(200).send('ok'));

app.use('/api/auth', authRoutes);
// Facilities are readable pre-login so the signup form can populate its facility picker;
// write routes inside facilities.routes.js are still individually role-gated.
app.use('/api/facilities', facilitiesRoutes);

app.use('/api', requireAuth);
// Defense-in-depth: Auditors have read-only access across the entire app. Rejecting
// every non-GET request here (rather than per-route) covers every current and future
// write route in one place without needing individual role checks everywhere.
app.use('/api', (req, res, next) => {
  if (req.user?.role === 'Auditor' && req.method !== 'GET') {
    return res.status(403).json({ success: false, error: 'Auditors have read-only access' });
  }
  next();
});
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/cycles', cyclesRoutes);
app.use('/api/indicators', indicatorsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/grievances', grievancesRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/chat', chatRoutes);

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => res.status(500).json({ success: false, error: err.message || 'Internal server error' }));

const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;
app.listen(port, () => console.log(`HealthConnect Pro backend listening on ${port}`));
