const mongoose = require('mongoose');
const { ACTIVITY_ENTITIES } = require('../utils/constants');

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true, maxlength: 50 }, // e.g. "task.completed"
    entityType: { type: String, enum: ACTIVITY_ENTITIES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { versionKey: false } }
);

activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('Activity', activitySchema);
