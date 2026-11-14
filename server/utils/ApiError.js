/** Operational error with an HTTP status code, handled by the central error handler. */
class ApiError extends Error {
  constructor(statusCode, message, { errors, code } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;
  }

  static badRequest(msg, opts) { return new ApiError(400, msg, opts); }
  static unauthorized(msg = 'Not authenticated. Please log in.', opts) { return new ApiError(401, msg, opts); }
  static forbidden(msg = 'You do not have permission to perform this action.', opts) { return new ApiError(403, msg, opts); }
  static notFound(msg = 'Resource not found.') { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
}

module.exports = ApiError;
