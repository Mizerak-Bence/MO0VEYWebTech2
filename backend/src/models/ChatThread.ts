import mongoose, { type InferSchemaType } from 'mongoose';
import { CHAT_THREAD_RETENTION_SECONDS } from '../chat-retention';
import { chatThreadStatusValues } from '../chat-thread-status';

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
    status: { type: String, enum: chatThreadStatusValues, required: true, default: 'new_interest' },
    messages: { type: [chatMessageSchema], default: [] },
    latestMessageAt: { type: Date, required: true, default: Date.now },
    ownerSeenAt: { type: Date, required: false },
    requesterSeenAt: { type: Date, required: false },
  },
  { timestamps: true }
);

chatThreadSchema.index({ palinkaId: 1, requesterId: 1 }, { unique: true });
chatThreadSchema.index({ latestMessageAt: 1 }, { expireAfterSeconds: CHAT_THREAD_RETENTION_SECONDS });

export type ChatThread = InferSchemaType<typeof chatThreadSchema>;

export const ChatThreadModel = mongoose.model('ChatThread', chatThreadSchema);