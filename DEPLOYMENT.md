# Deployment structure

This project is organized for a simple full-stack deployment with the frontend in the public folder and the API server in the server folder.

```text
Family-Tree-Full-Stack-Project/
├── public/
│   ├── index.html
│   ├── main.js
│   ├── tree.js
│   ├── style.css
│   └── logo.png
├── server/
│   ├── index.js
│   ├── package.json
│   ├── db/
│   │   ├── database.js
│   │   └── init.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   └── FamilyTree.js
│   └── routes/
│       └── family.js
├── vercel.json
├── .env
└── README.md
```

## Deployment notes

- The Express server entry point is server/index.js.
- Static frontend assets are served from public/.
- The database uses a local LibSQL file fallback by default, so the app can run without cloud credentials.
- If you want to use a remote Turso database, set these environment variables:
  - TURSO_DATABASE_URL
  - TURSO_AUTH_TOKEN
  - ADMIN_PASSWORD
  - JWT_SECRET

## Run locally

```bash
cd server
npm install
npm run dev
```

Then open http://localhost:3000.
