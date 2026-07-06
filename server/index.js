// ─────────────────────────────────────────
// server/index.js
// Express app entry point
// ─────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const familyRoutes = require('./routes/family');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Serve frontend (HTML/CSS/JS) from /public ──
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API routes ──
app.use('/api', familyRoutes);

// ── Fallback to index.html for any other route ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌳 Family Tree server running at http://localhost:${PORT}`);
});
