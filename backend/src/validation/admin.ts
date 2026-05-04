import { z } from 'zod';

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    isDisabled: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isDisabled !== undefined, {
    message: 'At least one field must be provided.',
  });

export const transferPalinkaOwnershipSchema = z.object({
  targetUserId: z.string().trim().min(1).max(100),
  palinkaIds: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'A kiválasztott tételek között duplikáció van.',
    }),
});