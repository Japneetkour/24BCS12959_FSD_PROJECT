/**
 * Holds the Socket.io server instance so any module (controllers, cron jobs)
 * can push real-time events without importing server.js.
 */
let io = null;

const setIO = (instance) => { io = instance; };
const getIO = () => io;

const emitToUser = (userId, event, payload) => {
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

const emitToGroup = (groupId, event, payload) => {
  if (io) io.to(`group:${groupId}`).emit(event, payload);
};

module.exports = { setIO, getIO, emitToUser, emitToGroup };
