import mongoose, { type InferSchemaType } from 'mongoose';
import { palinkaHistoryEventTypeValues } from '../palinka-history';
import { palinkaStatusValues } from '../palinka-status';

const palinkaHistorySchema = new mongoose.Schema(
  {
    type: { type: String, enum: palinkaHistoryEventTypeValues, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    actorDisplayName: { type: String, required: true, trim: true, maxlength: 80 },
    actorUsername: { type: String, required: false, trim: true, maxlength: 50 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: false, trim: true, maxlength: 240 },
    changedFields: { type: [String], default: [] },
    status: { type: String, enum: palinkaStatusValues, required: false },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true }
);

const palinkaSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    fruitType: { type: String, required: true, trim: true, maxlength: 60 },
    abvPercent: { type: Number, required: false, min: 0, max: 100 },
    volumeLiters: { type: Number, required: true, min: 0 },
    volumeMinLiters: { type: Number, required: false, min: 0 },
    volumeMaxLiters: { type: Number, required: false, min: 0 },
    containerCapacityLiters: { type: Number, required: false, min: 0 },
    status: { type: String, enum: palinkaStatusValues, required: true, default: 'active' },
    distillationStyle: { type: String, required: true, trim: true, maxlength: 60 },
    madeDate: { type: Date, required: false },
    notes: { type: String, required: false, trim: true, maxlength: 500 },
    history: { type: [palinkaHistorySchema], default: [] },

    sourceFile: { type: String, required: false, trim: true, maxlength: 200 },
    sourceLine: { type: String, required: false, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

palinkaSchema.index({ ownerId: 1, name: 1 }, { unique: true });

export type Palinka = InferSchemaType<typeof palinkaSchema>;

export const PalinkaModel = mongoose.model('Palinka', palinkaSchema);
