const { setupDB, teardownDB, clearDB, createUserAndLogin } = require('./helpers');
const { scoreTask } = require('../services/priorityService');
const { runReminderCycle } = require('../services/reminderService');
const { Notification } = require('../models');

beforeAll(setupDB);
afterAll(teardownDB);
afterEach(clearDB);

const inHours = (h) => new Date(Date.now() + h * 36e5).toISOString();

describe('Tasks', () => {
  test('CRUD, toggle and ownership isolation', async () => {
    const { agent } = await createUserAndLogin();
    const created = await agent.post('/api/tasks').send({ title: 'Lab report', subject: 'Physics', priority: 'high', dueDate: inHours(30) });
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    expect(created.body.data.priorityRank).toBe(3);

    const toggled = await agent.patch(`/api/tasks/${id}/toggle`);
    expect(toggled.body.data.status).toBe('completed');
    expect(toggled.body.data.completedAt).toBeTruthy();

    const updated = await agent.patch(`/api/tasks/${id}`).send({ status: 'todo', title: 'Lab report v2' });
    expect(updated.body.data.title).toBe('Lab report v2');
    expect(updated.body.data.completedAt).toBeUndefined();

    const other = await createUserAndLogin({ email: 'other@uni.edu' });
    expect((await other.agent.get(`/api/tasks/${id}`)).status).toBe(404);
    expect((await other.agent.delete(`/api/tasks/${id}`)).status).toBe(404);

    expect((await agent.delete(`/api/tasks/${id}`)).status).toBe(200);
  });

  test('filters overdue tasks and sorts by priority', async () => {
    const { agent } = await createUserAndLogin();
    await agent.post('/api/tasks').send({ title: 'Late one', priority: 'low', dueDate: inHours(-5) });
    await agent.post('/api/tasks').send({ title: 'Big one', priority: 'high', dueDate: inHours(50) });
    await agent.post('/api/tasks').send({ title: 'Mid one', priority: 'medium', dueDate: inHours(10) });

    const overdue = await agent.get('/api/tasks?due=overdue');
    expect(overdue.body.data.items.map((t) => t.title)).toEqual(['Late one']);
    expect(overdue.body.data.items[0].isOverdue).toBe(true);

    const byPriority = await agent.get('/api/tasks?sort=priority');
    expect(byPriority.body.data.items[0].title).toBe('Big one');

    const stats = await agent.get('/api/tasks/stats');
    expect(stats.body.data).toMatchObject({ total: 3, overdue: 1, completed: 0 });
  });

  test('smart prioritisation favours urgent + important work', () => {
    const urgentHigh = scoreTask({ priority: 'high', status: 'todo', dueDate: inHours(5), type: 'assignment' });
    const distantLow = scoreTask({ priority: 'low', status: 'todo', dueDate: inHours(24 * 20), type: 'task' });
    const overdue = scoreTask({ priority: 'medium', status: 'todo', dueDate: inHours(-2), type: 'task' });
    expect(urgentHigh.score).toBeGreaterThan(distantLow.score);
    expect(overdue.score).toBeGreaterThan(distantLow.score);
    expect(urgentHigh.label).toBe('Do now');
    expect(scoreTask({ priority: 'high', status: 'completed' }).score).toBe(-1);
  });

  test('reminder job sends deadline and reminder notifications exactly once', async () => {
    const { agent, user } = await createUserAndLogin();
    await agent.post('/api/tasks').send({ title: 'Due soon', dueDate: inHours(3) });
    await agent.post('/api/tasks').send({ title: 'Remind me', dueDate: inHours(72), reminderAt: inHours(-0.1) });

    const first = await runReminderCycle();
    expect(first).toBe(2);
    expect(await runReminderCycle()).toBe(0);
    const types = (await Notification.find({ recipient: user._id })).map((n) => n.type).sort();
    expect(types).toEqual(['deadline', 'reminder']);
  });
});
