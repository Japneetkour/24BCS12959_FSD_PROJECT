const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, DEPARTMENTS } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: { type: String, required: [true, 'Password is required'], minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    department: { type: String, enum: DEPARTMENTS, default: 'Computer Science' },
    semester: { type: Number, min: 1, max: 10, default: 1 },
    rollNumber: { type: String, trim: true, maxlength: 30, default: '' },
    bio: { type: String, trim: true, maxlength: 300, default: '' },
    avatar: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Resource' }],
    lastLoginAt: Date,
    passwordChangedAt: Date,
    verificationToken: { type: String, select: false },
    verificationExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.verificationToken;
        delete ret.verificationExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ name: 'text', email: 'text', rollNumber: 'text' });
userSchema.index({ department: 1, semester: 1 });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  // Subtract 1s so a token issued right after the change is still valid.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** True if the password changed after the JWT (iat, seconds) was issued. */
userSchema.methods.changedPasswordAfter = function changedPasswordAfter(jwtIat) {
  if (!this.passwordChangedAt) return false;
  return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtIat;
};

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Generates a random one-time token. Only its SHA-256 hash is stored, so a
 * leaked database cannot be used to verify accounts or reset passwords.
 */
userSchema.methods.createOneTimeToken = function createOneTimeToken(kind) {
  const raw = crypto.randomBytes(32).toString('hex');
  if (kind === 'verification') {
    this.verificationToken = hash(raw);
    this.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else {
    this.resetPasswordToken = hash(raw);
    this.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
  }
  return raw;
};

userSchema.statics.hashToken = hash;

module.exports = mongoose.model('User', userSchema);
