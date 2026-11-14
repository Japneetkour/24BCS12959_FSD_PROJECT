const { setupDB, teardownDB, clearDB, createUserAndLogin } = require('./helpers');
const { Notification, Event } = require('../models');
const { buildPdf } = require('../utils/seed');

beforeAll(setupDB);
afterAll(teardownDB);
afterEach(clearDB);

const day = 24 * 36e5;

describe('Study groups', () => {
  test('private group: invite → notification → accept → chat', async () => {
    const owner = await createUserAndLogin({ email: 'owner@uni.edu' });
    const friend = await createUserAndLogin({ email: 'friend@uni.edu' });

    const g = await owner.agent.post('/api/groups').send({ name: 'Secret Squad', subject: 'Maths', isPrivate: true });
    expect(g.status).toBe(201);
    const id = g.body.data._id;

    expect((await friend.agent.post(`/api/groups/${id}/join`)).status).toBe(403);
    expect((await owner.agent.post(`/api/groups/${id}/invite`).send({ email: 'friend@uni.edu' })).status).toBe(200);
    expect(await Notification.countDocuments({ recipient: friend.user._id, type: 'group_invite' })).toBe(1);

    const invites = await friend.agent.get('/api/groups/invites');
    expect(invites.body.data[0].name).toBe('Secret Squad');

    const accepted = await friend.agent.post(`/api/groups/${id}/invite/respond`).send({ accept: true });
    expect(accepted.body.data.isMember).toBe(true);

    expect((await friend.agent.post(`/api/groups/${id}/messages`).send({ content: 'Hello!' })).status).toBe(201);
    const msgs = await owner.agent.get(`/api/groups/${id}/messages`);
    expect(msgs.body.data.items.map((m) => m.content)).toContain('Hello!');

    expect((await owner.agent.post(`/api/groups/${id}/leave`)).status).toBe(400); // owner must transfer first
    expect((await friend.agent.post(`/api/groups/${id}/leave`)).status).toBe(200);
    expect((await friend.agent.get(`/api/groups/${id}/messages`)).status).toBe(403);
  });
});

describe('Resources', () => {
  test('upload PDF, download, bookmark and reject executables', async () => {
    const { agent } = await createUserAndLogin();
    const pdf = buildPdf('Notes', ['line one']);

    const up = await agent
      .post('/api/resources')
      .field('title', 'Calculus notes')
      .field('subject', 'Mathematics')
      .field('semester', '2')
      .attach('file', pdf, { filename: 'calc.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    expect(up.body.data.file.filename).toBeUndefined(); // disk name never exposed

    const dl = await agent.get(`/api/resources/${up.body.data._id}/download`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toMatch(/calc\.pdf/);

    const bm = await agent.post(`/api/resources/${up.body.data._id}/bookmark`);
    expect(bm.body.data.isBookmarked).toBe(true);
    const list = await agent.get('/api/resources?bookmarked=true');
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].downloads).toBe(1);

    const bad = await agent
      .post('/api/resources')
      .field('title', 'Virus')
      .field('subject', 'Hacking')
      .field('semester', '2')
      .attach('file', Buffer.from('MZ...'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });
    expect(bad.status).toBe(400);
  });
});

describe('Events & announcements', () => {
  test('admin creates event; capacity is enforced; students cannot create', async () => {
    const admin = await createUserAndLogin({ role: 'admin', email: 'admin@uni.edu' });
    const s1 = await createUserAndLogin({ email: 's1@uni.edu' });
    const s2 = await createUserAndLogin({ email: 's2@uni.edu' });

    const body = {
      title: 'Robotics Workshop', description: 'Build a line follower robot.', venue: 'Lab 1',
      startDate: new Date(Date.now() + 2 * day).toISOString(), endDate: new Date(Date.now() + 2 * day + 7200000).toISOString(), capacity: 1,
    };
    expect((await s1.agent.post('/api/events').send(body)).status).toBe(403);
    const ev = await admin.agent.post('/api/events').send(body);
    expect(ev.status).toBe(201);
    const id = ev.body.data._id;

    expect((await s1.agent.post(`/api/events/${id}/register`)).status).toBe(200);
    expect((await s1.agent.post(`/api/events/${id}/register`)).status).toBe(400);
    const full = await s2.agent.post(`/api/events/${id}/register`);
    expect(full.status).toBe(400);
    expect(full.body.message).toMatch(/full/);

    const participants = await admin.agent.get(`/api/events/${id}/participants`);
    expect(participants.body.data.items).toHaveLength(1);

    expect((await s1.agent.delete(`/api/events/${id}/register`)).status).toBe(200);
    expect((await Event.findById(id)).registrationsCount).toBe(0);
  });

  test('announcements are targeted by department and notify only that audience', async () => {
    const admin = await createUserAndLogin({ role: 'admin', email: 'admin@uni.edu' });
    const cs = await createUserAndLogin({ email: 'cs@uni.edu', department: 'Computer Science', semester: 5 });
    const me = await createUserAndLogin({ email: 'me@uni.edu', department: 'Mechanical', semester: 5 });

    const res = await admin.agent
      .post('/api/announcements')
      .send({ title: 'CS lab moved', content: 'Lab moved to Friday.', department: 'Computer Science' });
    expect(res.status).toBe(201);
    expect(res.body.data.recipients).toBe(1);

    expect((await cs.agent.get('/api/announcements')).body.data.items).toHaveLength(1);
    expect((await me.agent.get('/api/announcements')).body.data.items).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 100)); // notifications are fanned out asynchronously
    expect(await Notification.countDocuments({ recipient: cs.user._id, type: 'announcement' })).toBe(1);
    expect(await Notification.countDocuments({ recipient: me.user._id })).toBe(0);
  });

  test('dashboard, analytics, calendar and global search respond', async () => {
    const { agent } = await createUserAndLogin();
    await agent.post('/api/tasks').send({ title: 'Quantum homework', dueDate: new Date(Date.now() + day).toISOString() });
    const dash = await agent.get('/api/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.data.upcomingDeadlines).toHaveLength(1);
    expect(dash.body.data.weeklyCompletion).toHaveLength(7);

    expect((await agent.get('/api/analytics/me')).body.data.completionTrend).toHaveLength(8);

    const start = new Date(Date.now() - day).toISOString();
    const end = new Date(Date.now() + 3 * day).toISOString();
    const cal = await agent.get(`/api/calendar?start=${start}&end=${end}`);
    expect(cal.body.data[0].title).toBe('Quantum homework');

    const search = await agent.get('/api/search?q=quantum');
    expect(search.body.data.tasks).toHaveLength(1);
  });
});
