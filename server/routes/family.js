// ─────────────────────────────────────────
// routes/family.js
// REST API for family tree members
// ─────────────────────────────────────────

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const db = require('../db/database');
const { FamilyTree } = require('../models/FamilyTree');
const verifyToken = require('../middleware/auth');

const tree = new FamilyTree();

// Helper — load all rows from DB and rebuild the tree
function rebuildTree() {
  const rows = db.prepare('SELECT * FROM members').all();
  tree.buildFromRows(rows);
  return tree;
}

// ────────────────────────────────────────────
// GET /api/members  → entire tree as nested JSON
// ────────────────────────────────────────────
router.get('/members', (req, res) => {
  rebuildTree();
  const json = tree.toJSON();
  res.json(json);
});

// ────────────────────────────────────────────
// POST /api/members  → add a new member (ADMIN ONLY)
// body: { name, relation, parentId, isAlive }
// ────────────────────────────────────────────
router.post('/members', verifyToken, (req, res) => {
  const { name, relation, parentId, isAlive } = req.body;

  if (!name || !relation) {
    return res.status(400).json({ error: 'Name and relation are required.' });
  }

  // parentId must exist if provided (except for the very first root)
  if (parentId) {
    const parentExists = db.prepare('SELECT id FROM members WHERE id = ?').get(parentId);
    if (!parentExists) {
      return res.status(400).json({ error: 'Parent member not found.' });
    }
  }

  const stmt = db.prepare(
    'INSERT INTO members (name, relation, parentId, isAlive) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name, relation, parentId || null, isAlive ? 1 : 0);

  rebuildTree();
  res.status(201).json({ id: result.lastInsertRowid, tree: tree.toJSON() });
});

// ────────────────────────────────────────────
// PATCH /api/members/:id  → toggle alive status (ADMIN ONLY)
// body: { isAlive: 0 | 1 }
// ────────────────────────────────────────────
router.patch('/members/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { isAlive } = req.body;

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  db.prepare('UPDATE members SET isAlive = ? WHERE id = ?').run(isAlive ? 1 : 0, id);

  rebuildTree();
  res.json({ success: true, tree: tree.toJSON() });
});

// ────────────────────────────────────────────
// DELETE /api/members/:id  → delete member + all descendants (ADMIN ONLY)
// Uses tree.collectSubtreeIds() (DFS) to cascade-delete a whole branch
// ────────────────────────────────────────────
router.delete('/members/:id', verifyToken, (req, res) => {
  const { id } = req.params;

  rebuildTree();
  const node = tree.findById(Number(id));
  if (!node) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const idsToDelete = tree.collectSubtreeIds(node);
  const placeholders = idsToDelete.map(() => '?').join(',');
  db.prepare(`DELETE FROM members WHERE id IN (${placeholders})`).run(...idsToDelete);

  rebuildTree();
  res.json({ success: true, deletedIds: idsToDelete, tree: tree.toJSON() });
});

// ────────────────────────────────────────────
// POST /api/login  → admin login, returns JWT
// body: { password }
// ────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

module.exports = router;
