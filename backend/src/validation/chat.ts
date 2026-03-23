import { z } from 'zod';

export const reservePalinkaSchema = z.object({
  palinkaId: z.string().trim().min(1),
  initialMessage: z.string().trim().max(500).optional(),
});

export const sendChatMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});