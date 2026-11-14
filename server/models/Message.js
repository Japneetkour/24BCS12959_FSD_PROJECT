const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyGroup', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, trim: true, maxlength: 2000, required: [true, 'Message cannot be empty'] },
    type: { type: String, enum: ['text', 'resource', 'system'], default: 'text' },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

module.exports = mongoose.model('Message', messageSchema);
