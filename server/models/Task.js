const mongoose = require('mongoose');
const { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES, PRIORITY_RANK } = require('../utils/constants');

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    subject: { type: String, trim: true, maxlength: 60, default: 'General' },
    type: { type: String, enum: TASK_TYPES, default: 'task' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    priorityRank: { type: Number, min: 1, max: 3, default: 2 },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    dueDate: { type: Date },
    reminderAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
    deadlineNotified: { type: Boolean, default: false },
    completedAt: { type: Date },
    tags: [{ type: String, trim: true, maxlength: 30 }],
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false }, toObject: { virtuals: true } }
);

taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ user: 1, status: 1 });
taskSchema.index({ reminderAt: 1, reminderSent: 1 });

taskSchema.virtual('isOverdue').get(function isOverdue() {
  return Boolean(this.dueDate && this.status !== 'completed' && this.dueDate < new Date());
});

taskSchema.pre('validate', function syncDerivedFields() {
  this.priorityRank = PRIORITY_RANK[this.priority] || 2;
  if (this.isModified('status')) {
    this.completedAt = this.status === 'completed' ? this.completedAt || new Date() : undefined;
  }
  if (this.isModified('dueDate')) this.deadlineNotified = false;
  if (this.isModified('reminderAt')) this.reminderSent = false;
});

module.exports = mongoose.model('Task', taskSchema);
