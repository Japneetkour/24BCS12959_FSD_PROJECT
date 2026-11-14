/**
 * Smart task prioritisation.
 *
 * score = importance + urgency (+1 for graded assignments)
 *   importance: low 3 · medium 6 · high 9
 *   urgency:    overdue 12, otherwise 10·e^(−daysLeft/3) (≈10 due now, ≈3.7 in 3 days, ≈1 in a week)
 *               no deadline → 1
 * Completed tasks score −1 and sink to the bottom.
 */
const IMPORTANCE = { low: 3, medium: 6, high: 9 };

function describeTimeLeft(hoursLeft) {
  if (hoursLeft < 0) {
    const h = Math.abs(hoursLeft);
    return h < 24 ? `overdue by ${Math.ceil(h)}h` : `overdue by ${Math.ceil(h / 24)}d`;
  }
  if (hoursLeft < 1) return 'due within the hour';
  if (hoursLeft < 24) return `due in ${Math.round(hoursLeft)}h`;
  return `due in ${Math.round(hoursLeft / 24)}d`;
}

function scoreTask(task, now = new Date()) {
  if (task.status === 'completed') {
    return { score: -1, label: 'Done', reason: 'Completed' };
  }
  const importance = IMPORTANCE[task.priority] || 6;
  let urgency = 1;
  let timeText = 'no deadline';

  if (task.dueDate) {
    const hoursLeft = (new Date(task.dueDate) - now) / 36e5;
    urgency = hoursLeft < 0 ? 12 : 10 * Math.exp(-hoursLeft / 24 / 3);
    timeText = describeTimeLeft(hoursLeft);
  }

  const score = Math.round((importance + urgency + (task.type === 'assignment' ? 1 : 0)) * 10) / 10;
  let label = 'Later';
  if (score >= 15) label = 'Do now';
  else if (score >= 10) label = 'Do next';
  else if (score >= 6) label = 'Plan';

  const priorityText = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`;
  return { score, label, reason: `${priorityText} · ${timeText}` };
}

/** Returns tasks enriched with { smart: { score, label, reason } }, highest score first. */
function rankTasks(tasks, now = new Date()) {
  return tasks
    .map((t) => {
      const obj = typeof t.toJSON === 'function' ? t.toJSON() : t;
      return { ...obj, smart: scoreTask(obj, now) };
    })
    .sort((a, b) => b.smart.score - a.smart.score);
}

module.exports = { scoreTask, rankTasks };
