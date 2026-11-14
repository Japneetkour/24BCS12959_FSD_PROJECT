const mongoose = require('mongoose');
const { GROUP_ROLES } = require('../utils/constants');

const { ObjectId } = mongoose.Schema.Types;

const memberSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: GROUP_ROLES, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inviteSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    invitedBy: { type: ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const studyGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Group name is required'], trim: true, minlength: 3, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    subject: { type: String, required: [true, 'Subject is required'], trim: true, maxlength: 60 },
    owner: { type: ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
    invites: { type: [inviteSchema], default: [] },
    isPrivate: { type: Boolean, default: false },
    maxMembers: { type: Number, min: 2, max: 200, default: 50 },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

studyGroupSchema.index({ 'members.user': 1 });
studyGroupSchema.index({ 'invites.user': 1 });
studyGroupSchema.index({ name: 'text', description: 'text', subject: 'text' });

studyGroupSchema.methods.getMember = function getMember(userId) {
  return this.members.find((m) => String(m.user?._id || m.user) === String(userId));
};

studyGroupSchema.methods.isMember = function isMember(userId) {
  return Boolean(this.getMember(userId));
};

studyGroupSchema.methods.canManage = function canManage(userId) {
  const m = this.getMember(userId);
  return Boolean(m && (m.role === 'owner' || m.role === 'admin'));
};

module.exports = mongoose.model('StudyGroup', studyGroupSchema);
