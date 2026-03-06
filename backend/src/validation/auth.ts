import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6).max(200),
});

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(1).max(200),
});
