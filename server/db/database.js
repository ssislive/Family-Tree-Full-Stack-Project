// ─────────────────────────────────────────
// db/database.js
// Sets up SQLite database & "members" table
// ─────────────────────────────────────────

const Database = require('better-sqlite3');
const path = require('path');

// DB file will be created at project-root/family.db
const dbPath = path.join(__dirname, '..', '..', 'family.db');
const db = new Database(dbPath);

// Create table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    relation  TEXT NOT NULL,
    parentId  INTEGER,                 -- NULL = root node
    isAlive   INTEGER NOT NULL DEFAULT 1,  -- 1 = alive, 0 = not alive
    FOREIGN KEY (parentId) REFERENCES members(id)
  )
`);

// Seed one ROOT member if table is empty
const countRow = db.prepare('SELECT COUNT(*) AS count FROM members').get();
if (countRow.count === 0) {
  db.prepare(
    'INSERT INTO members (name, relation, parentId, isAlive) VALUES (?, ?, ?, ?)'
  ).run('Munshi karam Das Sahab', 'Patriarch', null, 1);

  console.log('🌱 Seeded database with a default ROOT member.');
}

module.exports = db;
