const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const RESOURCE_DIR = path.join(config.uploadDir, 'resources');
const AVATAR_DIR = path.join(config.uploadDir, 'avatars');
[RESOURCE_DIR, AVATAR_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

// Extension and MIME type must BOTH be on the allow-list.
const RESOURCE_TYPES = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain', 'text/x-markdown', 'application/octet-stream'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
};

const AVATAR_TYPES = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
};

const storage = (dir) =>
  multer.diskStorage({
    destination: dir,
    // Random server-side name: user input never reaches the filesystem path.
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  });

const filter = (allowed, label) => (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed[ext] && allowed[ext].includes(file.mimetype)) return cb(null, true);
  return cb(ApiError.badRequest(`Unsupported file type. Allowed ${label}: ${Object.keys(allowed).join(', ')}`));
};

const uploadResource = multer({
  storage: storage(RESOURCE_DIR),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter: filter(RESOURCE_TYPES, 'documents'),
}).single('file');

const uploadAvatar = multer({
  storage: storage(AVATAR_DIR),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: filter(AVATAR_TYPES, 'images'),
}).single('avatar');

/** Deletes an uploaded file; ignores "file not found". */
function removeFile(filePath) {
  fs.promises.unlink(filePath).catch((err) => {
    if (err.code !== 'ENOENT') console.error('[upload] could not delete file:', err.message);
  });
}

module.exports = { uploadResource, uploadAvatar, removeFile, RESOURCE_DIR, AVATAR_DIR };
