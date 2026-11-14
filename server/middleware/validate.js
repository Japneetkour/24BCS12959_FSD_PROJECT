const fs = require('fs');
const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs after express-validator chains; converts failures into a 422 ApiError. */
const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  // Multipart requests are parsed (and the file stored) before validation — clean up.
  if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(new ApiError(422, errors[0].message, { errors }));
};

module.exports = validate;
