/** Wraps async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Parses ?page & ?limit into safe numbers. */
function getPagination(query = {}, { defaultLimit = 12, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function paginated(items, total, { page, limit }) {
  return { items, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Escapes user input before it is used inside a RegExp (prevents ReDoS / regex injection). */
const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchRegex = (q) => new RegExp(escapeRegex(String(q).trim().slice(0, 100)), 'i');

/** Copies only the allowed keys that are present on the source object. */
function pick(source, keys) {
  return keys.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});
}

const sendSuccess = (res, data, status = 200, message) =>
  res.status(status).json({ success: true, ...(message && { message }), data });

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const idEquals = (a, b) => String(a?._id || a) === String(b?._id || b);

/** Server timezone, so MongoDB date bucketing matches JS day boundaries. */
const SERVER_TZ = process.env.TZ_NAME || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

module.exports = {
  asyncHandler,
  getPagination,
  paginated,
  escapeRegex,
  searchRegex,
  pick,
  sendSuccess,
  startOfDay,
  endOfDay,
  addDays,
  idEquals,
  SERVER_TZ,
};
