const { initDb } = require('./database');

initDb()
  .then(() => {
    console.log('Database initialized successfully.');
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
