const mongoose = require('mongoose');
const { ANNOUNCEMENT_CATEGORIES, DEPARTMENTS } = require('../utils/constants');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 3, maxlength: 150 },
    content: { type: String, required: [true, 'Content is required'], trim: true, maxlength: 5000 },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: 'general' },
    department: { type: String, enum: ['All', ...DEPARTMENTS], default: 'All' },
    semester: { type: Number, min: 0, max: 10, default: 0 }, // 0 = all semesters
    priority: { type: String, enum: ['normal', 'important'], default: 'normal' },
    isPinned: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

announcementSchema.index({ department: 1, semester: 1 });
announcementSchema.index({ isPinned: -1, createdAt: -1 });
announcementSchema.index({ title: 'text', content: 'text' });

/** Mongo filter for announcements visible to a given student. */
announcementSchema.statics.audienceFilter = function audienceFilter(user) {
  return {
    department: { $in: ['All', user.department] },
    semester: { $in: [0, user.semester] },
  };
};

module.exports = mongoose.model('Announcement', announcementSchema);
