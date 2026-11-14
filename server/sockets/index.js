const cookie = require('cookie');
const { Server } = require('socket.io');
const config = require('../config/env');
const { StudyGroup } = require('../models');
const { getUserFromToken } = require('../middleware/auth');
const { setIO } = require('../services/socketService');
const { createMessage } = require('../services/messageService');

/**
 * Socket.io server.
 *  - Handshake is authenticated with the same JWT as the REST API (httpOnly cookie,
 *    or `auth.token` for non-browser clients).
 *  - Every socket joins `user:<id>` for personal notifications.
 *  - Group chat rooms `group:<id>` are joined only after a membership check.
 */
function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    maxHttpBufferSize: 1e5, // 100 KB per message — chat text only
  });

  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = socket.handshake.auth?.token || cookies[config.jwt.cookieName];
      socket.user = await getUserFromToken(token);
      next();
    } catch (err) {
      next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(`user:${user._id}`);

    const isMember = (groupId) =>
      StudyGroup.exists({ _id: groupId, 'members.user': user._id }).catch(() => null);

    socket.on('group:join', async ({ groupId } = {}, ack = () => {}) => {
      if (!groupId || !(await isMember(groupId))) return ack({ ok: false, error: 'Not a member of this group' });
      socket.join(`group:${groupId}`);
      return ack({ ok: true });
    });

    socket.on('group:leave', ({ groupId } = {}) => {
      if (groupId) socket.leave(`group:${groupId}`);
    });

    socket.on('message:send', async ({ groupId, content } = {}, ack = () => {}) => {
      try {
        const text = typeof content === 'string' ? content.trim() : '';
        if (!text || text.length > 2000) return ack({ ok: false, error: 'Message must be 1–2000 characters' });
        if (!(await isMember(groupId))) return ack({ ok: false, error: 'Not a member of this group' });
        const message = await createMessage({ groupId, senderId: user._id, content: text });
        return ack({ ok: true, message });
      } catch (err) {
        return ack({ ok: false, error: 'Could not send message' });
      }
    });

    socket.on('typing', ({ groupId, isTyping } = {}) => {
      if (!groupId || !socket.rooms.has(`group:${groupId}`)) return;
      socket.to(`group:${groupId}`).emit('typing', {
        groupId,
        isTyping: Boolean(isTyping),
        user: { _id: user._id, name: user.name },
      });
    });
  });

  setIO(io);
  return io;
}

module.exports = initSocket;
