import { z } from 'zod';

export const createPalinkaSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  fruitType: z.string().trim().min(2).max(60),
  abvPercent: z.number().min(0).max(100).optional(),
  volumeLiters: z.number().min(0),
  volumeMinLiters: z.number().min(0).optional(),
  volumeMaxLiters: z.number().min(0).optional(),
  containerCapacityLiters: z.number().min(0).optional(),
  distillationStyle: z.string().trim().min(2).max(60),
  madeDate: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});
