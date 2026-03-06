import { z } from 'zod';

export const createPalinkaSchema = z.object({
  name: z.string().trim().min(2).max(100),
  fruitType: z.string().trim().min(2).max(60),
  abvPercent: z.number().min(0).max(100),
  volumeLiters: z.number().min(0),
  distillationStyle: z.string().trim().min(2).max(60),
  madeDate: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});
