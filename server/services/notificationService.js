const { Notification } = require('../models');
const { emitToUser } = require('./socketService');

/**
 * Persists a notification and pushes it in real time to the recipient's
 * socket room. Persisting first means nothing is lost if the user is offline.
 */
async function notify(recipientId, { type = 'system', title, message = '', link = '', meta } = {}) {
  const notification = await Notification.create({ recipient: recipientId, type, title, message, link, meta });
  emitToUser(recipientId, 'notification:new', notification.toJSON());
  return notification;
}

/** Bulk version used for announcements / events sent to many students. */
async function notifyMany(recipientIds, { type = 'system', title, message = '', link = '', meta } = {}) {
  if (!recipientIds.length) return [];
  const docs = await Notification.insertMany(
    recipientIds.map((recipient) => ({ recipient, type, title, message, link, meta })),
    { ordered: false }
  );
  docs.forEach((doc) => emitToUser(doc.recipient, 'notification:new', doc.toJSON()));
  return docs;
}

/** Never let a notification failure break the main request. */
const safe = (fn) => (...args) =>
  fn(...args).catch((err) => console.error('[notification] failed:', err.message));

module.exports = { notify, notifyMany, notifySafe: safe(notify), notifyManySafe: safe(notifyMany) };
