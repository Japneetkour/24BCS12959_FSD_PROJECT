const multer = require('multer');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

/** Normalises every error type into { success:false, message, errors? }. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(field === 'email' ? 'An account with this email already exists.' : `Duplicate value for ${field}.`);
  } else if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    error = new ApiError(422, errors[0]?.message || 'Validation failed', { errors });
  } else if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is too large. Maximum size is ${config.maxFileSizeMb} MB.` : err.message;
    error = ApiError.badRequest(msg);
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body.');
  } else if (err.type === 'entity.too.large') {
    error = new ApiError(413, 'Request body is too large.');
  } else if (!(err instanceof ApiError)) {
    error = new ApiError(err.statusCode || 500, config.isProd ? 'Something went wrong. Please try again.' : err.message);
  }

  if (error.statusCode >= 500) console.error('[error]', err);

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.errors && { errors: error.errors }),
    ...(!config.isProd && error.statusCode >= 500 && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
