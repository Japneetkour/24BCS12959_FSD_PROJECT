const mongoose = require('mongoose');
const { RESOURCE_TYPES } = require('../utils/constants');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    subject: { type: String, required: [true, 'Subject is required'], trim: true, maxlength: 60 },
    semester: { type: Number, min: 1, max: 10, required: [true, 'Semester is required'] },
    type: { type: String, enum: RESOURCE_TYPES, default: 'notes' },
    file: {
      originalName: { type: String, required: true },
      filename: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
    },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyGroup', default: null },
    downloads: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true, maxlength: 30 }],
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform(_doc, ret) {
        if (ret.file) delete ret.file.filename; // never expose the on-disk name
        return ret;
      },
    },
  }
);

resourceSchema.index({ subject: 1, semester: 1 });
resourceSchema.index({ group: 1 });
resourceSchema.index({ uploadedBy: 1 });
resourceSchema.index({ title: 'text', description: 'text', subject: 'text', tags: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
