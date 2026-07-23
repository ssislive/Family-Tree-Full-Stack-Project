// ─────────────────────────────────────────
// routes/family.js
// REST API for family tree members (async Turso version)
// ─────────────────────────────────────────

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const db = require('../db/database');
const { FamilyTree } = require('../models/FamilyTree');
const verifyToken = require('../middleware/auth');

const tree = new FamilyTree();

// Helper — load all rows from DB and rebuild the tree
async function rebuildTree() {
  const result = await db.execute('SELECT * FROM members');
  const rows = result.rows.map(r => ({
    id: Number(r.id),
    name: r.name,
    relation: r.relation,
    parentId: r.parentId !== null ? Number(r.parentId) : null,
    isAlive: Number(r.isAlive) === 1,
  }));
  tree.buildFromRows(rows);
  return tree;
}

// ────────────────────────────────────────────
// GET /api/members  → entire tree as nested JSON
// ────────────────────────────────────────────
router.get('/members', async (req, res) => {
  try {
    await rebuildTree();
    res.json(tree.toJSON());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load family tree.' });
  }
});

// ────────────────────────────────────────────
// POST /api/members  → add a new member (ADMIN ONLY)
// body: { name, relation, parentId, isAlive }
// ────────────────────────────────────────────
router.post('/members', verifyToken, async (req, res) => {
  const { name, relation, parentId, isAlive } = req.body;

  if (!name || !relation) {
    return res.status(400).json({ error: 'Name and relation are required.' });
  }

  try {
    if (parentId) {
      const parentResult = await db.execute({
        sql: 'SELECT id FROM members WHERE id = ?',
        args: [parentId],
      });
      if (parentResult.rows.length === 0) {
        return res.status(400).json({ error: 'Parent member not found.' });
      }
    }

    const result = await db.execute({
      sql: 'INSERT INTO members (name, relation, parentId, isAlive) VALUES (?, ?, ?, ?)',
      args: [name, relation, parentId || null, isAlive ? 1 : 0],
    });

    await rebuildTree();
    res.status(201).json({ id: Number(result.lastInsertRowid), tree: tree.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add member.' });
  }
});

// ────────────────────────────────────────────
// PATCH /api/members/:id  → toggle alive status (ADMIN ONLY)
// body: { isAlive: 0 | 1 }
// ────────────────────────────────────────────
router.patch('/members/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { isAlive } = req.body;

  try {
    const memberResult = await db.execute({
      sql: 'SELECT * FROM members WHERE id = ?',
      args: [id],
    });
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    await db.execute({
      sql: 'UPDATE members SET isAlive = ? WHERE id = ?',
      args: [isAlive ? 1 : 0, id],
    });

    await rebuildTree();
    res.json({ success: true, tree: tree.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update member.' });
  }
});

// ────────────────────────────────────────────
// DELETE /api/members/:id  → delete member + all descendants (ADMIN ONLY)
// ────────────────────────────────────────────
router.delete('/members/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    await rebuildTree();
    const node = tree.findById(Number(id));
    if (!node) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const idsToDelete = tree.collectSubtreeIds(node);

    // Delete one by one (Turso doesn't support spread args for IN clause easily)
    for (const delId of idsToDelete) {
      await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [delId] });
    }

    await rebuildTree();
    res.json({ success: true, deletedIds: idsToDelete, tree: tree.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete member.' });
  }
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
