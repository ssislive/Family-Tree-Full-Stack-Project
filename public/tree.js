/* ─────────────────────────────────────────
   tree.js
   Fetches family tree data from the API and
   renders it dynamically with smooth
   expand/collapse animations.
───────────────────────────────────────── */

const API_BASE = '/api';

// ── Layout constants ──
const NODE_WIDTH    = 160;   // horizontal spacing per node
const LEVEL_HEIGHT   = 150;   // vertical spacing per generation
const CANVAS_CENTER_X = 900;  // root node x position

// ── Global state ──
let rawTreeData   = null;          // full tree as fetched from API (nested)
let collapsedIds  = new Set();     // ids of nodes whose children are hidden
let nodeIdToAdd   = null;          // which node's "+" was clicked (parentId for new member)
let lastPositionedData = [];       // flat list of computed layout node positions

const nodesLayer = document.getElementById('nodes-layer');
const svg        = document.getElementById('tree-svg');
const loadingEl  = document.getElementById('loading');

/* ════════════════════════════════════════
   1. FETCH TREE DATA FROM API
════════════════════════════════════════ */
async function fetchTree() {
  try {
    const res = await fetch(`${API_BASE}/members`);
    if (!res.ok) throw new Error('Failed to load tree');
    rawTreeData = await res.json();
    renderTree();
    if (typeof onTreeLoaded === 'function') {
      onTreeLoaded();
    }
  } catch (err) {
    console.error(err);
    nodesLayer.innerHTML = `<div style="color:#7070a0;padding:40px;">Could not load family tree. Is the server running?</div>`;
    loadingEl.classList.add('hidden');
  }
}

/* ════════════════════════════════════════
   2. COMPUTE LAYOUT (DFS over visible nodes)
   Each node gets {x, y} pixel coordinates.
   Collapsed nodes do not lay out their children.
════════════════════════════════════════ */
function computeLayout(root) {
  const positioned = []; // flat list of {node, x, y, parent}
  let leafCounter = 0;

  function isCollapsed(node) {
    return collapsedIds.has(node.id);
  }

  // First pass — assign each visible leaf an x-slot (post-order)
  function assignX(node) {
    const visibleChildren = isCollapsed(node) ? [] : node.children;

    if (visibleChildren.length === 0) {
      const x = leafCounter * NODE_WIDTH;
      leafCounter++;
      node._x = x;
      return x;
    }

    const childXs = visibleChildren.map(assignX);
    const minX = Math.min(...childXs);
    const maxX = Math.max(...childXs);
    node._x = (minX + maxX) / 2;
    return node._x;
  }

  assignX(root);

  // Second pass — assign y by depth, collect into flat list
  function assignY(node, depth, parentRef) {
    const y = depth * LEVEL_HEIGHT + 130;
    positioned.push({
      node,
      x: node._x + (CANVAS_CENTER_X - root._x),
      y,
      parent: parentRef,
    });

    const visibleChildren = isCollapsed(node) ? [] : node.children;
    visibleChildren.forEach(child => assignY(child, depth + 1, { x: node._x + (CANVAS_CENTER_X - root._x), y }));
  }

  assignY(root, 0, null);
  return positioned;
}

/* ════════════════════════════════════════
   3. RENDER TREE  (nodes + connecting lines)
   Diffs against existing DOM nodes so we can
   animate enter / move / exit smoothly.
════════════════════════════════════════ */
function renderTree() {
  if (!rawTreeData) return;

  const positioned = computeLayout(rawTreeData);
  lastPositionedData = positioned;
  const currentIds = new Set(positioned.map(p => p.node.id));

  // ── Remove nodes that are no longer visible (collapsed away) ──
  nodesLayer.querySelectorAll('.node-wrap').forEach(el => {
    const id = Number(el.dataset.id);
    if (!currentIds.has(id)) {
      el.classList.add('exiting');
      el.classList.remove('entered');
      setTimeout(() => el.remove(), 450);
    }
  });

  // ── Render / update each visible node ──
  positioned.forEach(({ node, x, y }) => {
    let wrap = nodesLayer.querySelector(`.node-wrap[data-id="${node.id}"]`);
    const isNew = !wrap;

    if (isNew) {
      wrap = buildNodeElement(node);
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
      wrap.classList.add('entering');
      nodesLayer.appendChild(wrap);
      // Force reflow then animate in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          wrap.classList.remove('entering');
          wrap.classList.add('entered');
        });
      });
    } else {
      updateNodeElement(wrap, node);
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
    }
  });

  // ── Draw connecting lines ──
  drawConnectors(positioned);
}

/* ════════════════════════════════════════
   4. BUILD A SINGLE NODE DOM ELEMENT
════════════════════════════════════════ */
function buildNodeElement(node) {
  const wrap = document.createElement('div');
  wrap.className = 'node-wrap';
  wrap.dataset.id = node.id;

  const hasChildren = node.children && node.children.length > 0;
  const isCollapsedNode = collapsedIds.has(node.id);
  const aliveClass = node.isAlive ? 'alive' : 'dead';
  const aliveLabel = node.isAlive ? 'Alive' : 'Non-Alive';

  wrap.innerHTML = `
    <div class="node ${isCollapsedNode ? 'collapsed' : ''}" data-id="${node.id}">
      <div class="node-indicator ${aliveClass}" data-id="${node.id}" title="Click to toggle status"></div>
      <div class="node-tooltip">
        <div><strong>${escapeHtml(node.name)}</strong></div>
        <div class="tooltip-status">
          <div class="tooltip-dot ${aliveClass}"></div> ${aliveLabel}
        </div>
      </div>
      <div class="node-name">${escapeHtml(node.name)}</div>
      <div class="node-relation">${escapeHtml(node.relation)}</div>
      ${hasChildren ? `<div class="collapse-badge">${node.children.length} hidden</div>` : ''}
    </div>
    <div class="add-child-btn" data-id="${node.id}" title="Add child member">＋</div>
  `;

  attachNodeEvents(wrap, node);
  return wrap;
}

function updateNodeElement(wrap, node) {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsedNode = collapsedIds.has(node.id);
  const aliveClass = node.isAlive ? 'alive' : 'dead';
  const aliveLabel = node.isAlive ? 'Alive' : 'Non-Alive';

  const nodeEl = wrap.querySelector('.node');
  nodeEl.classList.toggle('collapsed', isCollapsedNode);

  const indicator = wrap.querySelector('.node-indicator');
  indicator.className = `node-indicator ${aliveClass}`;

  const tooltipDot = wrap.querySelector('.tooltip-dot');
  tooltipDot.className = `tooltip-dot ${aliveClass}`;
  wrap.querySelector('.tooltip-status').lastChild.textContent = ` ${aliveLabel}`;

  wrap.querySelector('.node-name').textContent = node.name;
  wrap.querySelector('.node-relation').textContent = node.relation;

  let badge = wrap.querySelector('.collapse-badge');
  if (hasChildren) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'collapse-badge';
      nodeEl.appendChild(badge);
    }
    badge.textContent = `${node.children.length} hidden`;
  } else if (badge) {
    badge.remove();
  }
}

/* ════════════════════════════════════════
   5. NODE EVENT HANDLERS
════════════════════════════════════════ */
function attachNodeEvents(wrap, node) {
  const nodeEl = wrap.querySelector('.node');
  const indicator = wrap.querySelector('.node-indicator');
  const addBtn = wrap.querySelector('.add-child-btn');

  // Click node body → toggle expand/collapse
  nodeEl.addEventListener('click', () => {
    if (!node.children || node.children.length === 0) return; // leaf, nothing to toggle
    if (collapsedIds.has(node.id)) {
      collapsedIds.delete(node.id);
    } else {
      collapsedIds.add(node.id);
    }
    renderTree();
  });

  // Click indicator dot → toggle alive status (admin only)
  indicator.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!isAdmin()) return;
    await toggleAlive(node.id, !node.isAlive);
  });

  // Click "+" → open add-member dialog for this node as parent (admin only)
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isAdmin()) return;
    openAddMemberDialog(node.id, node.name);
  });
}

/* ════════════════════════════════════════
   6. DRAW SVG CONNECTOR LINES
════════════════════════════════════════ */
function drawConnectors(positioned) {
  svg.innerHTML = '';
  const NODE_HALF_HEIGHT = 30; // approx visual offset for nicer curve start/end

  positioned.forEach(({ node, x, y, parent }) => {
    if (!parent) return;

    const x1 = parent.x + NODE_WIDTH / 2;
    const y1 = parent.y + NODE_HALF_HEIGHT + 28;
    const x2 = x + NODE_WIDTH / 2;
    const y2 = y;

    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'tree-line');
    path.setAttribute('d', d);
    svg.appendChild(path);
  });
}

/* ════════════════════════════════════════
   7. API ACTIONS  (add member / toggle alive)
════════════════════════════════════════ */
async function toggleAlive(id, isAlive) {
  try {
    const res = await fetch(`${API_BASE}/members/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ isAlive }),
    });
    if (!res.ok) throw new Error('Failed to update status');
    const data = await res.json();
    rawTreeData = data.tree;
    renderTree();
  } catch (err) {
    console.error(err);
    alert('Could not update status. Please try logging in again.');
  }
}

async function addMember(name, relation, parentId, isAlive) {
  const res = await fetch(`${API_BASE}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ name, relation, parentId, isAlive }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add member');
  }

  rawTreeData = data.tree;
  // make sure the parent isn't collapsed so the new node is visible
  if (parentId) collapsedIds.delete(parentId);
  renderTree();
}

/* ════════════════════════════════════════
   8. HELPERS
════════════════════════════════════════ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openAddMemberDialog(parentId, parentName) {
  nodeIdToAdd = parentId;
  document.getElementById('addDialogTitle').textContent =
    parentId ? `Add Child of ${parentName}` : 'Add Root Member';
  document.getElementById('memberName').value = '';
  document.getElementById('memberRelation').value = '';
  document.getElementById('addError').textContent = '';
  openDialog('addDialog');
}

// Kick off
fetchTree();
