import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(50),
  displayName: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(6).max(200),
});

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
});

export const verifyCurrentPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
});
