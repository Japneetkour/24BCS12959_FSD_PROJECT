const mongoose = require('mongoose');
const config = require('./env');

let memoryServer = null;

/**
 * Connects to MongoDB. When MONGO_URI is "memory" an in-memory MongoDB
 * (mongodb-memory-server) is started — handy for demos and tests without
 * installing MongoDB. Data is lost when the process stops.
 */
async function connectDB(uri = config.mongoUri) {
  let target = uri;
  let inMemory = false;

  if (uri === 'memory') {
    // Lazy require: dev dependency, never needed in production.
    // eslint-disable-next-line global-require
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    target = memoryServer.getUri('campusconnect');
    inMemory = true;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(target, { autoIndex: true });
  if (!config.isTest) {
    console.log(`[db] Connected to MongoDB${inMemory ? ' (in-memory)' : ''}: ${mongoose.connection.name}`);
  }
  return { inMemory };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
