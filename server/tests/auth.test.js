const { app, request, setupDB, teardownDB, clearDB, createUserAndLogin } = require('./helpers');
const { User } = require('../models');

beforeAll(setupDB);
afterAll(teardownDB);
afterEach(clearDB);

const valid = { name: 'Asha Rao', email: 'asha@uni.edu', password: 'Secret123', department: 'Computer Science', semester: 3 };

describe('Auth', () => {
  test('registers with a university email and requires verification', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.requiresVerification).toBe(true);
    expect(res.body.data.devLink).toMatch(/\/verify-email\//);

    const user = await User.findOne({ email: valid.email }).select('+password');
    expect(user.password).not.toBe(valid.password); // hashed
    expect(user.isVerified).toBe(false);
  });

  test('rejects non-university email domains', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'asha@gmail.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/university email/i);
  });

  test('rejects weak passwords with a validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe('password');
  });

  test('blocks login until verified, then verify-email logs the user in', async () => {
    const reg = await request(app).post('/api/auth/register').send(valid);
    const blocked = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const token = reg.body.data.devLink.split('/').pop();
    const agent = request.agent(app);
    const verified = await agent.post('/api/auth/verify-email').send({ token });
    expect(verified.status).toBe(200);
    expect(verified.headers['set-cookie'][0]).toMatch(/cc_token=.*HttpOnly/i);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(valid.email);
    expect(me.body.data.user.password).toBeUndefined();
  });

  test('wrong password returns a generic 401', async () => {
    await createUserAndLogin({ email: 'x@uni.edu', password: 'Password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'x@uni.edu', password: 'Wrong1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Incorrect email or password.');
  });

  test('forgot + reset password flow invalidates the old password', async () => {
    await createUserAndLogin({ email: 'reset@uni.edu', password: 'Password123' });
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'reset@uni.edu' });
    expect(forgot.status).toBe(200);
    const token = forgot.body.data.devLink.split('/').pop();

    const reset = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'NewPass456' });
    expect(reset.status).toBe(200);

    const old = await request(app).post('/api/auth/login').send({ email: 'reset@uni.edu', password: 'Password123' });
    expect(old.status).toBe(401);
    const ok = await request(app).post('/api/auth/login').send({ email: 'reset@uni.edu', password: 'NewPass456' });
    expect(ok.status).toBe(200);

    const reused = await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'Another789' });
    expect(reused.status).toBe(400); // one-time token
  });

  test('protected routes require a token; Bearer header also works', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
    const { token } = await createUserAndLogin();
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('students cannot access admin routes', async () => {
    const { agent } = await createUserAndLogin();
    expect((await agent.get('/api/admin/stats')).status).toBe(403);
    const admin = await createUserAndLogin({ role: 'admin', email: 'boss@uni.edu' });
    expect((await admin.agent.get('/api/admin/stats')).status).toBe(200);
  });

  test('NoSQL operator injection in login is neutralised', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect([401, 422]).toContain(res.status);
  });
});
