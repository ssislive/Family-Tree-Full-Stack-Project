// ─────────────────────────────────────────
// models/FamilyTree.js
// DSA: Tree (N-ary Tree) implementation
// ─────────────────────────────────────────

/**
 * FamilyNode — a single node in the tree
 */
class FamilyNode {
  constructor(id, name, relation, isAlive) {
    this.id       = id;
    this.name     = name;
    this.relation = relation;
    this.isAlive  = !!isAlive;
    this.parent   = null;   // pointer to parent node
    this.children = [];     // array of child nodes
  }
}

/**
 * FamilyTree — N-ary Tree built from flat DB rows
 */
class FamilyTree {
  constructor() {
    this.root = null;
    this.map  = new Map(); // id -> FamilyNode  (O(1) lookup)
  }

  /**
   * Build the tree from a flat array of DB rows
   * rows: [{ id, name, relation, parentId, isAlive }, ...]
   */
  buildFromRows(rows) {
    this.root = null;
    this.map.clear();

    // Step 1 — create all nodes first
    rows.forEach(row => {
      const node = new FamilyNode(row.id, row.name, row.relation, row.isAlive);
      this.map.set(row.id, node);
    });

    // Step 2 — link parent <-> children
    rows.forEach(row => {
      const node = this.map.get(row.id);
      if (row.parentId === null || row.parentId === undefined) {
        this.root = node; // this is the ROOT
      } else {
        const parent = this.map.get(row.parentId);
        if (parent) {
          node.parent = parent;
          parent.children.push(node);
        }
      }
    });

    return this.root;
  }

  /**
   * DFS — find a node by id (O(n))
   */
  findById(id, node = this.root) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = this.findById(id, child);
      if (found) return found;
    }
    return null;
  }

  /**
   * DFS — convert tree (or subtree) into nested JSON
   * This is what gets sent to the frontend for D3.js rendering
   */
  toJSON(node = this.root) {
    if (!node) return null;
    return {
      id:       node.id,
      name:     node.name,
      relation: node.relation,
      isAlive:  node.isAlive,
      parentId: node.parent ? node.parent.id : null,
      children: node.children.map(child => this.toJSON(child)),
    };
  }

  /**
   * BFS — level-order traversal (handy for debugging / generation counts)
   */
  bfs() {
    const result = [];
    if (!this.root) return result;

    const queue = [this.root];
    while (queue.length) {
      const node = queue.shift();
      result.push(node);
      queue.push(...node.children);
    }
    return result;
  }

  /**
   * DFS — collect a node + all of its descendants' ids
   * Useful for cascading delete (remove a person and their whole branch)
   */
  collectSubtreeIds(node, ids = []) {
    if (!node) return ids;
    ids.push(node.id);
    node.children.forEach(child => this.collectSubtreeIds(child, ids));
    return ids;
  }

  /**
   * Tree height (total generations from root)
   */
  height(node = this.root) {
    if (!node) return 0;
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(c => this.height(c)));
  }
}

module.exports = { FamilyNode, FamilyTree };
