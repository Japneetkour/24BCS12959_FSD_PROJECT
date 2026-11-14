const fs = require('fs');
const path = require('path');
const { Resource, StudyGroup, User } = require('../models');
const ApiError = require('../utils/ApiError');
const {
  asyncHandler, sendSuccess, getPagination, paginated, pick, searchRegex, idEquals,
} = require('../utils/helpers');
const { removeFile, RESOURCE_DIR } = require('../middleware/upload');
const { logActivity } = require('../services/activityService');
const { createMessage } = require('../services/messageService');

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  popular: { downloads: -1, createdAt: -1 },
  bookmarked: { bookmarkCount: -1, createdAt: -1 },
  title: { title: 1 },
};

const parseTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string' && tags.trim()) return tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10);
  return undefined;
};

/** Ids of groups the user belongs to — used to scope group-only resources. */
const myGroupIds = async (userId) => (await StudyGroup.find({ 'members.user': userId }).select('_id').lean()).map((g) => g._id);

/** Public resources + resources of groups the user is in. Admins see everything. */
async function accessFilter(user) {
  if (user.role === 'admin') return {};
  return { $or: [{ group: null }, { group: { $in: await myGroupIds(user._id) } }] };
}

async function loadAccessible(id, user) {
  const resource = await Resource.findById(id);
  if (!resource) throw ApiError.notFound('Resource not found.');
  if (resource.group && user.role !== 'admin') {
    const isMember = await StudyGroup.exists({ _id: resource.group, 'members.user': user._id });
    if (!isMember) throw ApiError.forbidden('This resource is shared only with members of its study group.');
  }
  return resource;
}

const withFlags = (resource, user) => ({
  ...(typeof resource.toJSON === 'function' ? resource.toJSON() : resource),
  isBookmarked: user.bookmarks.some((b) => idEquals(b, resource._id)),
  canEdit: idEquals(resource.uploadedBy, user._id) || user.role === 'admin',
});

exports.getResources = asyncHandler(async (req, res) => {
  const q = req.query;
  const pg = getPagination(q, { defaultLimit: 12 });
  const and = [await accessFilter(req.user)];

  if (q.subject) and.push({ subject: q.subject });
  if (q.semester) and.push({ semester: Number(q.semester) });
  if (q.type) and.push({ type: q.type });
  if (q.mine === 'true') and.push({ uploadedBy: req.user._id });
  if (q.bookmarked === 'true') and.push({ _id: { $in: req.user.bookmarks } });
  if (q.group) and.push({ group: q.group });
  if (q.search) {
    const rx = searchRegex(q.search);
    and.push({ $or: [{ title: rx }, { description: rx }, { subject: rx }, { tags: rx }] });
  }
  const filter = { $and: and };

  const [items, total] = await Promise.all([
    Resource.find(filter)
      .sort(SORTS[q.sort] || SORTS.newest)
      .skip(pg.skip)
      .limit(pg.limit)
      .populate('uploadedBy', 'name avatar')
      .populate('group', 'name'),
    Resource.countDocuments(filter),
  ]);
  sendSuccess(res, paginated(items.map((r) => withFlags(r, req.user)), total, pg));
});

exports.getFilters = asyncHandler(async (req, res) => {
  const filter = await accessFilter(req.user);
  const [subjects, semesters] = await Promise.all([Resource.distinct('subject', filter), Resource.distinct('semester', filter)]);
  sendSuccess(res, { subjects: subjects.sort(), semesters: semesters.sort((a, b) => a - b) });
});

exports.createResource = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please attach a file to upload.');
  try {
    const data = pick(req.body, ['title', 'description', 'subject', 'semester', 'type']);
    const groupId = req.body.group || null;
    let group = null;
    if (groupId) {
      group = await StudyGroup.findById(groupId);
      if (!group || !group.isMember(req.user._id)) throw ApiError.forbidden('You can only share files with groups you belong to.');
    }

    const resource = await Resource.create({
      ...data,
      tags: parseTags(req.body.tags),
      group: groupId,
      uploadedBy: req.user._id,
      file: {
        originalName: req.file.originalname.slice(0, 200),
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    if (group) {
      await createMessage({
        groupId: group._id,
        senderId: req.user._id,
        content: `Shared a file: ${resource.title}`,
        type: 'resource',
        resourceId: resource._id,
      });
    }
    logActivity(req.user._id, 'resource.uploaded', 'resource', resource._id, `Uploaded "${resource.title}"`);
    await resource.populate('uploadedBy', 'name avatar');
    sendSuccess(res, withFlags(resource, req.user), 201, 'Resource uploaded.');
  } catch (err) {
    removeFile(req.file.path); // don't leave orphaned files on validation errors
    throw err;
  }
});

exports.getResource = asyncHandler(async (req, res) => {
  const resource = await loadAccessible(req.params.id, req.user);
  await resource.populate([{ path: 'uploadedBy', select: 'name avatar department' }, { path: 'group', select: 'name' }]);
  sendSuccess(res, withFlags(resource, req.user));
});

exports.updateResource = asyncHandler(async (req, res) => {
  const resource = await loadAccessible(req.params.id, req.user);
  if (!idEquals(resource.uploadedBy, req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the uploader can edit this resource.');
  }
  Object.assign(resource, pick(req.body, ['title', 'description', 'subject', 'semester', 'type']));
  const tags = parseTags(req.body.tags);
  if (tags) resource.tags = tags;
  await resource.save();
  await resource.populate('uploadedBy', 'name avatar');
  sendSuccess(res, withFlags(resource, req.user), 200, 'Resource updated.');
});

exports.deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  if (!resource) throw ApiError.notFound('Resource not found.');
  if (!idEquals(resource.uploadedBy, req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the uploader or an administrator can delete this resource.');
  }
  await resource.deleteOne();
  await User.updateMany({ bookmarks: resource._id }, { $pull: { bookmarks: resource._id } });
  removeFile(path.join(RESOURCE_DIR, resource.file.filename));
  logActivity(req.user._id, 'resource.deleted', 'resource', resource._id, `Deleted "${resource.title}"`);
  sendSuccess(res, { id: resource._id }, 200, 'Resource deleted.');
});

/** Streams the file after an access check; files are never served statically. */
exports.downloadResource = asyncHandler(async (req, res) => {
  const resource = await loadAccessible(req.params.id, req.user);
  // basename() guards against any path traversal in stored names.
  const filePath = path.join(RESOURCE_DIR, path.basename(resource.file.filename));
  if (!fs.existsSync(filePath)) throw ApiError.notFound('The file for this resource is missing on the server.');

  await Resource.updateOne({ _id: resource._id }, { $inc: { downloads: 1 } });
  logActivity(req.user._id, 'resource.downloaded', 'resource', resource._id, `Downloaded "${resource.title}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(filePath, resource.file.originalName);
});

exports.toggleBookmark = asyncHandler(async (req, res) => {
  const resource = await loadAccessible(req.params.id, req.user);
  const already = req.user.bookmarks.some((b) => idEquals(b, resource._id));

  if (already) {
    await User.updateOne({ _id: req.user._id }, { $pull: { bookmarks: resource._id } });
    await Resource.updateOne({ _id: resource._id, bookmarkCount: { $gt: 0 } }, { $inc: { bookmarkCount: -1 } });
  } else {
    await User.updateOne({ _id: req.user._id }, { $addToSet: { bookmarks: resource._id } });
    await Resource.updateOne({ _id: resource._id }, { $inc: { bookmarkCount: 1 } });
    logActivity(req.user._id, 'resource.bookmarked', 'resource', resource._id, `Bookmarked "${resource.title}"`);
  }
  sendSuccess(res, { isBookmarked: !already }, 200, already ? 'Bookmark removed.' : 'Added to bookmarks.');
});
