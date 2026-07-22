/* ─────────────────────────────────────────
   main.js
   UI chrome: dialogs, admin auth, zoom & pan.
   Tree data/rendering lives in tree.js.
───────────────────────────────────────── */

// ── Dialog helpers ──────────────────────
function openDialog(id) {
  document.getElementById(id).classList.add('open');
}

function closeDialog(id) {
  document.getElementById(id).classList.remove('open');
}

function openLogin() {
  if (isAdmin()) {
    // already logged in -> log out
    logoutAdmin();
    return;
  }
  document.getElementById('adminPassword').value = '';
  document.getElementById('loginError').textContent = '';
  openDialog('loginDialog');
}

// Close overlay when clicking outside the dialog box
document.querySelectorAll('.overlay').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) {
      if (el.id === 'nameDialog') return;
      el.classList.remove('open');
    }
  });
});

// ── Radio toggle (Alive / Non-Alive) ────
document.querySelectorAll('.radio-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.getElementById('opt-alive').classList.remove('selected-alive');
    document.getElementById('opt-dead').classList.remove('selected-dead');
    if (opt.id === 'opt-alive') opt.classList.add('selected-alive');
    else opt.classList.add('selected-dead');
  });
});

function getSelectedStatus() {
  return document.getElementById('opt-alive').classList.contains('selected-alive');
}

// ── Admin auth (token kept in memory only) ──
let adminToken = null;

function isAdmin() {
  return !!adminToken;
}

function getToken() {
  return adminToken;
}

function setAdmin(token) {
  adminToken = token;
  document.body.classList.add('is-admin');
  document.querySelector('.admin-btn').textContent = '⚙ Logout';
}

function logoutAdmin() {
  adminToken = null;
  document.body.classList.remove('is-admin');
  document.querySelector('.admin-btn').textContent = '⚙ Admin';
}

// ── Login submit ──
document.getElementById('submitLoginBtn').addEventListener('click', async () => {
  const password = document.getElementById('adminPassword').value.trim();
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  if (!password) {
    errorEl.textContent = 'Please enter a password.';
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed.';
      return;
    }

    setAdmin(data.token);
    closeDialog('loginDialog');
  } catch (err) {
    errorEl.textContent = 'Could not reach server.';
  }
});

// ── Add member submit ──
document.getElementById('submitAddBtn').addEventListener('click', async () => {
  const name = document.getElementById('memberName').value.trim();
  const relation = document.getElementById('memberRelation').value.trim();
  const isAlive = getSelectedStatus();
  const errorEl = document.getElementById('addError');
  errorEl.textContent = '';

  if (!name || !relation) {
    errorEl.textContent = 'Please fill in both name and relation.';
    return;
  }

  try {
    await addMember(name, relation, nodeIdToAdd, isAlive);
    closeDialog('addDialog');
  } catch (err) {
    errorEl.textContent = err.message || 'Could not add member.';
  }
});

// ── Zoom & Pan ───────────────────────────
const canvas    = document.getElementById('canvas');
const container = document.getElementById('tree-container');

let scale      = 1;
let translateX = 0;
let translateY = 0;
let isAnimatingLineage = false;

function applyTransform(transition = true) {
  container.style.transition = transition
    ? 'transform 0.3s ease'
    : 'none';
  container.style.transform =
    `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
}

// Zoom buttons
document.querySelectorAll('.zoom-btn').forEach((btn, i) => {
  btn.addEventListener('click', () => {
    if (isAnimatingLineage) return;
    if (i === 0) scale = Math.min(scale + 0.15, 2.5);   // zoom in
    else         scale = Math.max(scale - 0.15, 0.3);   // zoom out
    applyTransform(true);
  });
});

// Scroll-to-zoom
canvas.addEventListener('wheel', e => {
  if (isAnimatingLineage) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.08 : -0.08;
  scale = Math.min(Math.max(scale + delta, 0.3), 2.5);
  applyTransform(false);
}, { passive: false });

// Drag-to-pan
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

canvas.addEventListener('mousedown', e => {
  if (isAnimatingLineage) return;
  // don't start a pan drag if clicking directly on a node/button
  if (e.target.closest('.node, .add-child-btn, .node-indicator')) return;
  isDragging = true;
  dragStartX = e.clientX - translateX;
  dragStartY = e.clientY - translateY;
});

document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  translateX = e.clientX - dragStartX;
  translateY = e.clientY - dragStartY;
  applyTransform(false);
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

const pageLoadStartTime = Date.now();
const MIN_LOADING_TIME = 1500; // 1.5s minimum show time for loading state animations

// ── Visitor Name Dialog ──
window.onTreeLoaded = () => {
  const elapsedTime = Date.now() - pageLoadStartTime;
  const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

  setTimeout(() => {
    // Transition loading text to "Enter Website" button smoothly
    const loadingText = document.getElementById('loadingText');
    const enterBtn = document.getElementById('enterWebsiteBtn');
    
    if (loadingText && enterBtn) {
      loadingText.style.opacity = '0';
      setTimeout(() => {
        loadingText.classList.add('hidden');
        enterBtn.classList.remove('hidden');
        enterBtn.style.opacity = '0';
        requestAnimationFrame(() => {
          enterBtn.style.opacity = '1';
        });
      }, 300);
    }
  }, remainingTime);
};

// Race condition protection: if tree data is already loaded before main.js executed
if (typeof rawTreeData !== 'undefined' && rawTreeData) {
  window.onTreeLoaded();
}

// Click "Enter Website" on loading screen
document.getElementById('enterWebsiteBtn').addEventListener('click', () => {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.classList.add('hidden');
  }

  // Wait for the loading screen fade/blur transition (800ms) to complete, then open the name dialog
  setTimeout(() => {
    document.getElementById('visitorNameInput').value = '';
    document.getElementById('nameDialogError').textContent = '';
    openDialog('nameDialog');
  }, 800);
});

document.getElementById('submitNameBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('visitorNameInput').value.trim();
  const errorEl = document.getElementById('nameDialogError');
  errorEl.textContent = '';

  if (!nameInput) {
    errorEl.textContent = 'Please enter your first name.';
    return;
  }

  // Check if the name exists in the family tree
  if (rawTreeData) {
    const matchedNode = findNodeByFirstName(rawTreeData, nameInput);
    if (!matchedNode) {
      errorEl.textContent = 'Name does not exist in the family tree. Please try again.';
      return;
    }
  }

  localStorage.setItem('visitorName', nameInput);
  closeDialog('nameDialog');
  startLineageAnimation(nameInput);
});

document.getElementById('visitorNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    document.getElementById('submitNameBtn').click();
  }
});

// ── Skip button: close popup & show full tree ──
document.getElementById('skipNameBtn').addEventListener('click', () => {
  closeDialog('nameDialog');
  // Expand all nodes so the full tree is visible
  if (typeof collapsedIds !== 'undefined') collapsedIds.clear();
  if (typeof renderTree === 'function') renderTree();
  isAnimatingLineage = false;
});

// ── Lineage Animation Logic ──

function centerOnNodeCoordinates(x, y, duration = '0.8s') {
  const S = scale; // Keep the current scale
  // 80 is NODE_WIDTH / 2 (from NODE_WIDTH = 160)
  // 35 is approximate node height / 2
  translateX = window.innerWidth / 2 - (x + 80) * S;
  translateY = window.innerHeight / 2 - (y + 35) * S;
  
  container.style.transition = `transform ${duration} cubic-bezier(0.25, 1, 0.5, 1)`;
  container.style.transform = `scale(${S}) translate(${translateX / S}px, ${translateY / S}px)`;
}

function getNodeCoordinates(nodeId) {
  const found = lastPositionedData.find(p => p.node.id === nodeId);
  if (found) {
    return { x: found.x, y: found.y };
  }
  return null;
}

function centerOnNode(nodeId, duration = '0.8s') {
  const coords = getNodeCoordinates(nodeId);
  if (coords) {
    centerOnNodeCoordinates(coords.x, coords.y, duration);
  }
}

function findNodeByFirstName(node, firstName) {
  if (!node) return null;
  const nodeFirstName = node.name.trim().split(/\s+/)[0].toLowerCase();
  const targetFirstName = firstName.trim().split(/\s+/)[0].toLowerCase();
  if (nodeFirstName === targetFirstName) {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByFirstName(child, firstName);
      if (found) return found;
    }
  }
  return null;
}

function findPathToNode(node, targetId, currentPath = []) {
  if (!node) return null;
  const newPath = [...currentPath, node];
  if (node.id === targetId) {
    return newPath;
  }
  if (node.children) {
    for (const child of node.children) {
      const path = findPathToNode(child, targetId, newPath);
      if (path) return path;
    }
  }
  return null;
}

function collapseAll(node) {
  if (!node) return;
  collapsedIds.add(node.id);
  if (node.children) {
    node.children.forEach(collapseAll);
  }
}

function highlightVisitorNode(nodeId) {
  document.querySelectorAll('.node.visitor-highlight').forEach(el => {
    el.classList.remove('visitor-highlight');
  });

  const nodeEl = document.querySelector(`.node[data-id="${nodeId}"]`);
  if (nodeEl) {
    nodeEl.classList.add('visitor-highlight');
    nodeEl.style.animation = 'none';
    requestAnimationFrame(() => {
      nodeEl.style.animation = 'pulse-highlight 2s infinite alternate';
    });
  }
}

function startLineageAnimation(firstName) {
  if (!rawTreeData) return;

  const visitorNode = findNodeByFirstName(rawTreeData, firstName);
  if (!visitorNode) {
    console.log("Visitor name not found in the family tree.");
    // Smoothly pan to the root node if name is not found
    centerOnNode(rawTreeData.id, '1.2s');
    return;
  }

  const path = findPathToNode(rawTreeData, visitorNode.id);
  if (!path || path.length === 0) return;

  isAnimatingLineage = true;

  // Collapse all nodes to start with a clean state
  collapseAll(rawTreeData);
  renderTree();

  let step = 0;
  
  function nextStep() {
    if (step >= path.length) {
      highlightVisitorNode(visitorNode.id);
      
      // Wait 2 seconds, then expand all remaining nodes
      setTimeout(() => {
        collapsedIds.clear();
        renderTree();
        
        // Re-enable camera controls once layout animation finishes
        setTimeout(() => {
          isAnimatingLineage = false;
        }, 600);
      }, 2000);
      
      return;
    }

    const currentNode = path[step];
    
    // Center view on current node
    centerOnNode(currentNode.id, '1.0s');

    setTimeout(() => {
      // Expand node to reveal next generation
      if (currentNode.id !== visitorNode.id) {
        collapsedIds.delete(currentNode.id);
        renderTree();
      }
      step++;
      setTimeout(nextStep, 600);
    }, 1000);
  }

  // Kick off the sequence
  nextStep();
}
