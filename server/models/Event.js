const mongoose = require('mongoose');
const { EVENT_CATEGORIES } = require('../utils/constants');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 5000 },
    category: { type: String, enum: EVENT_CATEGORIES, default: 'academic' },
    venue: { type: String, required: [true, 'Venue is required'], trim: true, maxlength: 120 },
    organizer: { type: String, trim: true, maxlength: 100, default: 'University' },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'] },
    registrationDeadline: { type: Date },
    capacity: { type: Number, min: 0, max: 100000, default: 0 }, // 0 = unlimited
    registrationsCount: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false }, toObject: { virtuals: true } }
);

eventSchema.index({ startDate: 1 });
eventSchema.index({ category: 1, startDate: 1 });
eventSchema.index({ title: 'text', description: 'text', venue: 'text' });

eventSchema.virtual('spotsLeft').get(function spotsLeft() {
  return this.capacity > 0 ? Math.max(0, this.capacity - this.registrationsCount) : null;
});

eventSchema.pre('validate', function checkDates() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after the start date');
  }
  if (this.registrationDeadline && this.endDate && this.registrationDeadline > this.endDate) {
    this.invalidate('registrationDeadline', 'Registration deadline must be before the event ends');
  }
});

module.exports = mongoose.model('Event', eventSchema);
