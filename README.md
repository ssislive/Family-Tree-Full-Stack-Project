# Family Tree — Full Stack Project

A premium, interactive family tree web application with cinematic animations, ancestral lineage path tracing, and a modern dark-themed UI.

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT (admin-only add/edit)
- **DSA:** N-ary Tree (FamilyNode + FamilyTree class)

## Features

### Premium Loading Screen
- Full-screen background image (`bg.jpeg`) with a subtle blur overlay.
- Large logo (`logo.png`) with a smooth blur-to-clear entry animation.
- Staggered appearance: logo → title ("Our Family Tree") → slogan ("Connecting Generations, Celebrating Our Roots").
- "Enter Website" button appears after 1.5 seconds, transitioning smoothly from the loading text.

### Visitor Name Dialog
- On clicking "Enter Website", a dialog box opens asking the visitor to enter their **First Name according to their Adhaar Card**.
- The name is validated against the family tree database in real-time.
- If the name **does not match** any member, an error message is shown: "Name does not exist in the family tree."
- The dialog cannot be dismissed by clicking outside — the visitor must enter a valid name.

### Ancestral Lineage Path Animation
- After entering a valid name, the family tree collapses and a cinematic camera animation begins.
- The camera pans smoothly from the **root ancestor** down through each generation to the visitor's node.
- Each ancestor node is revealed one-by-one with expand/collapse animations.
- The visitor's node is highlighted with a glowing violet pulse effect.
- After 2 seconds, all remaining nodes expand to reveal the full family tree.

### Interactive Family Tree
- Zoomable and pannable canvas (mouse wheel + drag).
- Expand/collapse nodes by clicking on them.
- Alive/Non-Alive status indicators (green/red dots) with hover tooltips.
- Admin-only features: add members, toggle alive status (requires login).

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Edit `.env` and set your own ADMIN_PASSWORD and JWT_SECRET

3. Run the server:
   ```
   npm start
   ```
   Or for development with auto-reload:
   ```
   npm run dev
   ```

4. Open in browser:
   http://localhost:3000

## Project Structure

```
family-tree/
├── server/
│   ├── index.js              Express app entry
│   ├── db/database.js        SQLite setup + seed root member
│   ├── models/FamilyTree.js  Tree DSA (FamilyNode + FamilyTree classes)
│   ├── routes/family.js      REST API (GET/POST/PATCH/DELETE/login)
│   └── middleware/auth.js    JWT verification middleware
├── public/
│   ├── index.html            Main HTML (loading screen, dialogs, canvas)
│   ├── style.css             All styles (dark theme, animations, layout)
│   ├── main.js               UI logic (dialogs, zoom/pan, lineage animation)
│   ├── tree.js               Tree rendering (layout, nodes, connectors)
│   ├── bg.jpeg               Loading screen background image
│   └── logo.png              Loading screen logo
├── family.db                 SQLite database file
├── .env                      Environment variables
└── package.json
```

## API Endpoints

| Method | Route              | Auth  | Purpose                          |
|--------|---------------------|-------|-----------------------------------|
| GET    | /api/members         | No    | Get full tree as nested JSON      |
| POST   | /api/members         | Yes   | Add a new member                  |
| PATCH  | /api/members/:id      | Yes   | Toggle alive/non-alive status     |
| DELETE | /api/members/:id      | Yes   | Delete member + all descendants   |
| POST   | /api/login            | No    | Admin login, returns JWT token    |

## DSA Concept Used: N-ary Tree

Each family member is a `FamilyNode` with a `parent` pointer and a `children` array.
The `FamilyTree` class builds this structure from flat SQLite rows and supports:
- **DFS traversal** (toJSON, findById, collectSubtreeIds, findNodeByFirstName, findPathToNode)
- **BFS traversal** (bfs)
- **Tree height calculation** (height)

## User Flow

```
Loading Screen (bg + logo + title + slogan)
        │
        ▼  (1.5s delay)
  "Enter Website" button appears
        │
        ▼  (click)
  Loading screen fades out with blur
        │
        ▼
  Name Input Dialog (Adhaar Card disclaimer)
        │
        ▼  (valid name → "Reveal Lineage")
  Lineage Path Animation (root → visitor node)
        │
        ▼  (2s delay)
  Full Family Tree Revealed
```

## Animations Used

| Animation         | Type              | Description                                    |
|-------------------|-------------------|------------------------------------------------|
| `blur-entry`      | CSS Keyframes     | Logo/title/slogan fade from blur → clear       |
| `pulse-text`      | CSS Keyframes     | Loading text opacity pulse                     |
| `pulse-highlight` | CSS Keyframes     | Visitor node glow pulse effect                 |
| Camera Pan        | JS + CSS Transform| Smooth translate/scale transitions on canvas   |
| Node Enter/Exit   | CSS Transitions   | Scale + opacity animations for tree nodes      |
| Dialog Open/Close | CSS Transitions   | Scale + opacity overlay transitions            |
| Loading Fade-Out  | CSS Transitions   | Opacity + blur filter transition               |
