const { Activity } = require('../models');

/**
 * Records an entry in the user's activity history. Fire-and-forget: a logging
 * failure must never fail the user's request.
 */
function logActivity(userId, action, entityType, entityId, description) {
  if (!userId) return;
  Activity.create({ user: userId, action, entityType, entityId, description }).catch((err) =>
    console.error('[activity] failed to log:', err.message)
  );
}

module.exports = { logActivity };
