const cron = require('node-cron');
const { Task, Event, EventRegistration } = require('../models');
const { notify } = require('./notificationService');
const { addDays } = require('../utils/helpers');

/**
 * Background job (every 5 minutes):
 *  1. Custom task reminders (reminderAt reached).
 *  2. Deadline alerts for tasks due within 24 hours.
 *  3. Event reminders for registered students, 24 hours before start.
 * Flags (reminderSent / deadlineNotified) guarantee each alert fires once.
 */
async function runReminderCycle(now = new Date()) {
  let sent = 0;

  const reminders = await Task.find({ reminderAt: { $lte: now }, reminderSent: false, status: { $ne: 'completed' } }).limit(500);
  for (const task of reminders) {
    // eslint-disable-next-line no-await-in-loop
    await notify(task.user, {
      type: 'reminder',
      title: `Reminder: ${task.title}`,
      message: task.dueDate ? `Due ${task.dueDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : task.subject,
      link: '/tasks',
      meta: { taskId: task._id },
    });
    task.reminderSent = true;
    // eslint-disable-next-line no-await-in-loop
    await Task.updateOne({ _id: task._id }, { reminderSent: true });
    sent += 1;
  }

  const dueSoon = await Task.find({
    dueDate: { $gt: now, $lte: addDays(now, 1) },
    deadlineNotified: false,
    status: { $ne: 'completed' },
  }).limit(500);
  for (const task of dueSoon) {
    const hours = Math.max(1, Math.round((task.dueDate - now) / 36e5));
    // eslint-disable-next-line no-await-in-loop
    await notify(task.user, {
      type: 'deadline',
      title: `Deadline approaching: ${task.title}`,
      message: `Due in about ${hours} hour${hours === 1 ? '' : 's'} · ${task.priority} priority`,
      link: '/tasks',
      meta: { taskId: task._id },
    });
    // eslint-disable-next-line no-await-in-loop
    await Task.updateOne({ _id: task._id }, { deadlineNotified: true });
    sent += 1;
  }

  const soonEvents = await Event.find({ isPublished: true, startDate: { $gt: now, $lte: addDays(now, 1) } }).select('title venue startDate');
  if (soonEvents.length) {
    const regs = await EventRegistration.find({ event: { $in: soonEvents.map((e) => e._id) }, reminderSent: false }).limit(2000);
    for (const reg of regs) {
      const event = soonEvents.find((e) => String(e._id) === String(reg.event));
      // eslint-disable-next-line no-await-in-loop
      await notify(reg.user, {
        type: 'event',
        title: `Tomorrow: ${event.title}`,
        message: `${event.venue} · ${event.startDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
        link: `/events/${event._id}`,
      });
      // eslint-disable-next-line no-await-in-loop
      await EventRegistration.updateOne({ _id: reg._id }, { reminderSent: true });
      sent += 1;
    }
  }
  return sent;
}

function startReminderJob() {
  const task = cron.schedule('*/5 * * * *', () => {
    runReminderCycle().catch((err) => console.error('[reminders] cycle failed:', err.message));
  });
  // Run once shortly after boot so nothing waits a full interval.
  setTimeout(() => runReminderCycle().catch((err) => console.error('[reminders] cycle failed:', err.message)), 5000);
  console.log('[reminders] Reminder job scheduled (every 5 minutes)');
  return task;
}

module.exports = { startReminderJob, runReminderCycle };
