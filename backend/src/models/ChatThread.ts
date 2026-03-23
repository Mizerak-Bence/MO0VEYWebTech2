import mongoose, { type InferSchemaType } from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true }
);

const chatThreadSchema = new mongoose.Schema(
  {
    palinkaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Palinka', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['requested', 'open'], required: true, default: 'requested' },
    messages: { type: [chatMessageSchema], default: [] },
    latestMessageAt: { type: Date, required: true, default: Date.now },
    ownerSeenAt: { type: Date, required: false },
    requesterSeenAt: { type: Date, required: false },
  },
  { timestamps: true }
);

chatThreadSchema.index({ palinkaId: 1, requesterId: 1 }, { unique: true });

export type ChatThread = InferSchemaType<typeof chatThreadSchema>;

export const ChatThreadModel = mongoose.model('ChatThread', chatThreadSchema);