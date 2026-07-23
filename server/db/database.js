// ─────────────────────────────────────────
// db/database.js
// Sets up LibSQL with a local file fallback for development and deployment
// ─────────────────────────────────────────

const path = require('path');
const { pathToFileURL } = require('url');
const { createClient } = require('@libsql/client');

function getDatabaseUrl() {
  const configuredUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const dbPath = path.resolve(__dirname, '..', 'db', 'family.db');
  return pathToFileURL(dbPath).toString();
}

const db = createClient({
  url: getDatabaseUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// Create table + seed root if empty
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      relation  TEXT NOT NULL,
      parentId  INTEGER,
      isAlive   INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (parentId) REFERENCES members(id)
    )
  `);

  const result = await db.execute('SELECT COUNT(*) AS count FROM members');
  const count = result.rows[0].count;

  if (Number(count) === 0) {
    await db.execute({
      sql: 'INSERT INTO members (name, relation, parentId, isAlive) VALUES (?, ?, ?, ?)',
      args: ['Munshi karam Das Sahab', 'Patriarch', null, 1],
    });
    console.log('🌱 Seeded database with default ROOT member.');
  }
}

initDb().catch((err) => {
  console.error('Database init failed:', err);
});

module.exports = db;
module.exports.initDb = initDb;
