const path = require('path');
const { StudyGroup, Message, User, Resource } = require('../models');
const ApiError = require('../utils/ApiError');
const {
  asyncHandler, sendSuccess, getPagination, paginated, pick, searchRegex, idEquals,
} = require('../utils/helpers');
const { createMessage, systemMessage, SENDER_FIELDS } = require('../services/messageService');
const { notifySafe } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');
const { emitToGroup } = require('../services/socketService');
const { removeFile, RESOURCE_DIR } = require('../middleware/upload');

const MEMBER_FIELDS = 'name email avatar department semester';

/** Adds viewer-specific flags to a group document. */
function present(group, userId) {
  const obj = typeof group.toJSON === 'function' ? group.toJSON() : group;
  const me = obj.members.find((m) => idEquals(m.user, userId));
  return {
    ...obj,
    memberCount: obj.members.length,
    isMember: Boolean(me),
    myRole: me ? me.role : null,
    isInvited: obj.invites?.some((i) => idEquals(i.user, userId)) || false,
    invites: me && me.role !== 'member' ? obj.invites : undefined, // only managers see pending invites
  };
}

async function loadGroup(id) {
  const group = await StudyGroup.findById(id);
  if (!group) throw ApiError.notFound('Study group not found.');
  return group;
}

function assertMember(group, user) {
  if (!group.isMember(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('Join this group to access it.');
  }
}

function assertManager(group, user) {
  if (!group.canManage(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('Only group owners and admins can do this.');
  }
}

exports.getGroups = asyncHandler(async (req, res) => {
  const me = req.user._id;
  const pg = getPagination(req.query, { defaultLimit: 12 });
  const and = [];

  if (req.query.mine === 'true') and.push({ 'members.user': me });
  else and.push({ $or: [{ isPrivate: false }, { 'members.user': me }, { 'invites.user': me }] });
  if (req.query.subject) and.push({ subject: req.query.subject });
  if (req.query.search) {
    const rx = searchRegex(req.query.search);
    and.push({ $or: [{ name: rx }, { description: rx }, { subject: rx }, { tags: rx }] });
  }
  const filter = { $and: and };

  const [groups, total] = await Promise.all([
    StudyGroup.find(filter)
      .sort({ lastActivityAt: -1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .populate('owner', 'name avatar')
      .populate('members.user', 'name avatar')
      .lean(),
    StudyGroup.countDocuments(filter),
  ]);

  const items = groups.map((g) => {
    const p = present(g, me);
    return { ...p, members: p.members.slice(0, 5), invites: undefined };
  });
  sendSuccess(res, paginated(items, total, pg));
});

exports.getSubjects = asyncHandler(async (req, res) => {
  const subjects = await StudyGroup.distinct('subject', { $or: [{ isPrivate: false }, { 'members.user': req.user._id }] });
  sendSuccess(res, subjects.sort());
});

exports.createGroup = asyncHandler(async (req, res) => {
  const group = await StudyGroup.create({
    ...pick(req.body, ['name', 'description', 'subject', 'isPrivate', 'maxMembers', 'tags']),
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'owner' }],
  });
  await systemMessage(group._id, `${req.user.name} created the group`);
  logActivity(req.user._id, 'group.created', 'group', group._id, `Created study group "${group.name}"`);
  sendSuccess(res, present(group, req.user._id), 201, 'Study group created.');
});

exports.getGroup = asyncHandler(async (req, res) => {
  const group = await StudyGroup.findById(req.params.id)
    .populate('owner', 'name avatar')
    .populate('members.user', MEMBER_FIELDS)
    .populate('invites.user', 'name email avatar')
    .populate('invites.invitedBy', 'name');
  if (!group) throw ApiError.notFound('Study group not found.');

  const isInvited = group.invites.some((i) => idEquals(i.user, req.user._id));
  if (group.isPrivate && !group.isMember(req.user._id) && !isInvited && req.user.role !== 'admin') {
    throw ApiError.forbidden('This is a private group. You need an invitation to view it.');
  }
  sendSuccess(res, present(group, req.user._id));
});

exports.updateGroup = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  assertManager(group, req.user);
  const updates = pick(req.body, ['name', 'description', 'subject', 'isPrivate', 'maxMembers', 'tags']);
  if (updates.maxMembers && updates.maxMembers < group.members.length) {
    throw ApiError.badRequest(`The group already has ${group.members.length} members.`);
  }
  Object.assign(group, updates);
  await group.save();
  emitToGroup(group._id, 'group:updated', { groupId: group._id });
  sendSuccess(res, present(group, req.user._id), 200, 'Group updated.');
});

exports.deleteGroup = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  if (!idEquals(group.owner, req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the group owner can delete this group.');
  }
  // Group-only materials are private to the group, so they are removed with it.
  const resources = await Resource.find({ group: group._id }).select('file.filename');
  resources.forEach((r) => removeFile(path.join(RESOURCE_DIR, r.file.filename)));
  await Promise.all([
    Resource.deleteMany({ group: group._id }),
    User.updateMany({}, { $pull: { bookmarks: { $in: resources.map((r) => r._id) } } }),
    Message.deleteMany({ group: group._id }),
    group.deleteOne(),
  ]);
  emitToGroup(group._id, 'group:deleted', { groupId: group._id });
  logActivity(req.user._id, 'group.deleted', 'group', group._id, `Deleted study group "${group.name}"`);
  sendSuccess(res, { id: group._id }, 200, 'Group deleted.');
});

async function addMember(group, user) {
  if (group.isMember(user._id)) throw ApiError.badRequest('You are already a member of this group.');
  if (group.members.length >= group.maxMembers) throw ApiError.badRequest('This group is full.');
  group.members.push({ user: user._id, role: 'member' });
  group.invites = group.invites.filter((i) => !idEquals(i.user, user._id));
  group.lastActivityAt = new Date();
  await group.save();
  await systemMessage(group._id, `${user.name} joined the group`);
  emitToGroup(group._id, 'group:updated', { groupId: group._id });
  logActivity(user._id, 'group.joined', 'group', group._id, `Joined study group "${group.name}"`);
  if (!idEquals(group.owner, user._id)) {
    notifySafe(group.owner, {
      type: 'group',
      title: 'New group member',
      message: `${user.name} joined ${group.name}`,
      link: `/groups/${group._id}`,
    });
  }
}

exports.joinGroup = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  const invited = group.invites.some((i) => idEquals(i.user, req.user._id));
  if (group.isPrivate && !invited) throw ApiError.forbidden('This group is private. You need an invitation to join.');
  await addMember(group, req.user);
  sendSuccess(res, present(group, req.user._id), 200, `You joined ${group.name}.`);
});

exports.leaveGroup = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  const member = group.getMember(req.user._id);
  if (!member) throw ApiError.badRequest('You are not a member of this group.');
  if (member.role === 'owner') {
    throw ApiError.badRequest('Owners cannot leave their group. Transfer ownership to another member first, or delete the group.');
  }
  group.members = group.members.filter((m) => !idEquals(m.user, req.user._id));
  await group.save();
  await systemMessage(group._id, `${req.user.name} left the group`);
  emitToGroup(group._id, 'group:updated', { groupId: group._id });
  logActivity(req.user._id, 'group.left', 'group', group._id, `Left study group "${group.name}"`);
  sendSuccess(res, { id: group._id }, 200, `You left ${group.name}.`);
});

exports.inviteMember = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  assertManager(group, req.user);
  const invitee = await User.findOne({ email: req.body.email, isActive: true });
  if (!invitee) throw ApiError.notFound('No active student found with that email.');
  if (group.isMember(invitee._id)) throw ApiError.badRequest(`${invitee.name} is already a member.`);
  if (group.invites.some((i) => idEquals(i.user, invitee._id))) throw ApiError.badRequest(`${invitee.name} has already been invited.`);
  if (group.members.length >= group.maxMembers) throw ApiError.badRequest('This group is full.');

  group.invites.push({ user: invitee._id, invitedBy: req.user._id });
  await group.save();
  await notifySafe(invitee._id, {
    type: 'group_invite',
    title: 'Study group invitation',
    message: `${req.user.name} invited you to join "${group.name}"`,
    link: `/groups/${group._id}`,
    meta: { groupId: group._id },
  });
  logActivity(req.user._id, 'group.invited', 'group', group._id, `Invited ${invitee.name} to "${group.name}"`);
  sendSuccess(res, { invited: { _id: invitee._id, name: invitee.name, email: invitee.email } }, 200, `Invitation sent to ${invitee.name}.`);
});

exports.getMyInvites = asyncHandler(async (req, res) => {
  const groups = await StudyGroup.find({ 'invites.user': req.user._id })
    .select('name subject description isPrivate members invites owner')
    .populate('invites.invitedBy', 'name')
    .populate('owner', 'name')
    .lean();
  const items = groups.map((g) => {
    const invite = g.invites.find((i) => idEquals(i.user, req.user._id));
    return {
      _id: g._id,
      name: g.name,
      subject: g.subject,
      description: g.description,
      isPrivate: g.isPrivate,
      memberCount: g.members.length,
      owner: g.owner,
      invitedBy: invite.invitedBy,
      invitedAt: invite.createdAt,
    };
  });
  sendSuccess(res, items);
});

exports.respondToInvite = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  if (!group.invites.some((i) => idEquals(i.user, req.user._id))) throw ApiError.badRequest('You have no pending invitation for this group.');
  if (req.body.accept) {
    await addMember(group, req.user);
    return sendSuccess(res, present(group, req.user._id), 200, `You joined ${group.name}.`);
  }
  group.invites = group.invites.filter((i) => !idEquals(i.user, req.user._id));
  await group.save();
  return sendSuccess(res, { id: group._id }, 200, 'Invitation declined.');
});

exports.updateMemberRole = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  if (!idEquals(group.owner, req.user._id) && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the group owner can change member roles.');
  }
  const member = group.getMember(req.params.userId);
  if (!member) throw ApiError.notFound('Member not found.');
  if (member.role === 'owner') throw ApiError.badRequest("The owner's role cannot be changed.");

  if (req.body.role === 'owner') {
    // Ownership transfer: the previous owner becomes a group admin.
    const previousOwner = group.members.find((m) => m.role === 'owner');
    if (previousOwner) previousOwner.role = 'admin';
    group.owner = member.user;
    await systemMessage(group._id, 'Group ownership was transferred');
  }
  member.role = req.body.role;
  await group.save();
  emitToGroup(group._id, 'group:updated', { groupId: group._id });
  sendSuccess(res, { userId: req.params.userId, role: member.role }, 200, 'Member role updated.');
});

exports.removeMember = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  assertManager(group, req.user);
  const target = group.getMember(req.params.userId);
  if (!target) throw ApiError.notFound('Member not found.');
  if (target.role === 'owner') throw ApiError.badRequest('The group owner cannot be removed.');
  const actor = group.getMember(req.user._id);
  if (target.role === 'admin' && actor?.role !== 'owner' && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the owner can remove group admins.');
  }
  group.members = group.members.filter((m) => !idEquals(m.user, req.params.userId));
  await group.save();
  const removed = await User.findById(req.params.userId).select('name');
  await systemMessage(group._id, `${removed?.name || 'A member'} was removed from the group`);
  emitToGroup(group._id, 'group:updated', { groupId: group._id });
  notifySafe(req.params.userId, {
    type: 'group',
    title: 'Removed from group',
    message: `You were removed from "${group.name}"`,
    link: '/groups',
  });
  sendSuccess(res, { userId: req.params.userId }, 200, 'Member removed.');
});

/** Cursor-paginated history: ?before=<ISO date>&limit=30, returned oldest → newest. */
exports.getMessages = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  assertMember(group, req.user);
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const filter = { group: group._id };
  if (req.query.before) {
    const before = new Date(req.query.before);
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate('sender', SENDER_FIELDS)
    .populate('resource', 'title file.originalName file.size type');
  const hasMore = messages.length > limit;
  sendSuccess(res, { items: messages.slice(0, limit).reverse(), hasMore });
});

exports.postMessage = asyncHandler(async (req, res) => {
  const group = await loadGroup(req.params.id);
  if (!group.isMember(req.user._id)) throw ApiError.forbidden('Join this group to send messages.');
  const message = await createMessage({ groupId: group._id, senderId: req.user._id, content: req.body.content });
  sendSuccess(res, message, 201);
});
