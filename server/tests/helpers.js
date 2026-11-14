const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const { User } = require('../models');

let mongod;

async function setupDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

async function teardownDB() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDB() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

/** Creates a verified user directly and returns a logged-in supertest agent. */
async function createUserAndLogin(overrides = {}) {
  const data = {
    name: 'Test Student',
    email: `student${Math.random().toString(36).slice(2, 8)}@uni.edu`,
    password: 'Password123',
    isVerified: true,
    department: 'Computer Science',
    semester: 5,
    ...overrides,
  };
  const user = await new User(data).save();
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: data.email, password: data.password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.body.message}`);
  return { user, agent, token: res.body.data.token };
}

module.exports = { app, request, setupDB, teardownDB, clearDB, createUserAndLogin };
