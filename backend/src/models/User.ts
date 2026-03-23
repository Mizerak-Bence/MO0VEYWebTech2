import mongoose, { type InferSchemaType } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 50, unique: true },
    displayName: { type: String, required: false, trim: true, maxlength: 80 },
    role: { type: String, required: true, enum: ['user', 'admin'], default: 'user' },
    isSystemAdmin: { type: Boolean, required: true, default: false },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = mongoose.model('User', userSchema);
