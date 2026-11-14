const { Message, StudyGroup } = require('../models');
const { emitToGroup } = require('./socketService');

const SENDER_FIELDS = 'name avatar department';

/**
 * Creates a chat message, updates the group's activity timestamp and
 * broadcasts it to everyone in the group room. Used by both REST and Socket.io.
 */
async function createMessage({ groupId, senderId, content, type = 'text', resourceId }) {
  const message = await Message.create({ group: groupId, sender: senderId, content, type, resource: resourceId });
  await StudyGroup.updateOne({ _id: groupId }, { lastActivityAt: new Date() });
  await message.populate([
    { path: 'sender', select: SENDER_FIELDS },
    { path: 'resource', select: 'title file.originalName file.size type' },
  ]);
  const payload = message.toJSON();
  emitToGroup(groupId, 'message:new', payload);
  return payload;
}

/** System messages ("Priya joined the group") — never fail the calling request. */
const systemMessage = (groupId, content) =>
  createMessage({ groupId, content, type: 'system' }).catch((err) => console.error('[message] system message failed:', err.message));

module.exports = { createMessage, systemMessage, SENDER_FIELDS };
