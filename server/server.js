const http = require('http');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');
const initSocket = require('./sockets');
const { startReminderJob } = require('./services/reminderService');

async function start() {
  const { inMemory } = await connectDB();

  if (inMemory && config.seedOnMemory) {
    // eslint-disable-next-line global-require
    const { seedDatabase } = require('./utils/seed');
    await seedDatabase({ log: true });
  }

  const server = http.createServer(app);
  initSocket(server);
  const job = startReminderJob();

  server.listen(config.port, () => {
    console.log(`[server] CampusConnect API running on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down gracefully`);
    job.stop();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
