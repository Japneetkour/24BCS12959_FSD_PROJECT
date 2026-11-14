/* Usage: npm run seed  — wipes the database configured in .env and loads sample data. */
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { seedDatabase } = require('../utils/seed');

(async () => {
  if (config.mongoUri === 'memory') {
    console.log('[seed] MONGO_URI=memory — the in-memory database is seeded automatically when the server starts.');
    process.exit(0);
  }
  if (config.isProd && process.argv[2] !== '--force') {
    console.error('[seed] Refusing to wipe a production database. Re-run with "--force" if you really mean it.');
    process.exit(1);
  }
  try {
    await connectDB();
    await seedDatabase({ log: true });
  } catch (err) {
    console.error('[seed] Failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
