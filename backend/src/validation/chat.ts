import { z } from 'zod';
import { chatThreadStatusValues } from '../chat-thread-status';
import { isSafeText, safeTextValidationMessage } from './safe-text';

export const reservePalinkaSchema = z.object({
  palinkaId: z.string().trim().min(1),
  initialMessage: z.string().trim().max(500).refine(isSafeText, safeTextValidationMessage).optional(),
});

export const sendChatMessageSchema = z.object({
  text: z.string().trim().min(1).max(1000).refine(isSafeText, safeTextValidationMessage),
});

export const updateChatThreadStatusSchema = z.object({
  status: z.enum(chatThreadStatusValues),
});