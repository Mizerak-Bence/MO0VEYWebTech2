import { z } from 'zod';
import { palinkaStatusValues } from '../palinka-status';
import { isSafeText, safeTextValidationMessage } from './safe-text';

export const createPalinkaSchema = z.object({
  name: z.string().trim().min(2).max(100).refine(isSafeText, safeTextValidationMessage).optional(),
  fruitType: z.string().trim().min(2).max(60).refine(isSafeText, safeTextValidationMessage),
  abvPercent: z.number().min(0).max(100).optional(),
  volumeLiters: z.number().min(0),
  volumeMinLiters: z.number().min(0).optional(),
  volumeMaxLiters: z.number().min(0).optional(),
  containerCapacityLiters: z.number().min(0).optional(),
  status: z.enum(palinkaStatusValues).default('active'),
  distillationStyle: z.string().trim().min(2).max(60).refine(isSafeText, safeTextValidationMessage),
  madeDate: z.string().datetime().optional(),
  notes: z.string().trim().max(500).refine(isSafeText, safeTextValidationMessage).optional(),
});
