import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { config } from '../config';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  verifyCurrentPasswordSchema,
} from '../validation/auth';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

export const authRouter = Router();

const serializeUser = (user: any) => ({
  id: user._id.toString(),
  username: user.username,
  displayName: user.displayName ?? user.username,
  role: user.role,
  isSystemAdmin: !!user.isSystemAdmin,
  createdAt: user.createdAt,
});

const createToken = (user: any) =>
  jwt.sign({ userId: user._id.toString(), role: user.role, isSystemAdmin: !!user.isSystemAdmin }, config.jwtSecret, {
    expiresIn: '8h',
  });

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const { username, displayName, password } = parsed.data;
  const existing = await UserModel.findOne({ username }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const userCount = await UserModel.countDocuments();
  const role = userCount === 0 ? 'admin' : 'user';

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ username, displayName, role, passwordHash });
  const token = createToken(user);

  return res.status(201).json({ token, user: serializeUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const { username, password } = parsed.data;
  const user = await UserModel.findOne({ username });
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = createToken(user);
  return res.json({ token, user: serializeUser(user) });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await UserModel.findById(req.userId).lean();
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({ user: serializeUser(user) });
});

authRouter.patch('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const user = await UserModel.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.isSystemAdmin) {
    return res.status(403).json({ message: 'A rendszer admin profilja nem módosítható.' });
  }

  user.displayName = parsed.data.displayName;
  await user.save();

  return res.json({ user: serializeUser(user) });
});

authRouter.post('/verify-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = verifyCurrentPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const user = await UserModel.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.isSystemAdmin) {
    return res.status(403).json({ message: 'A rendszer admin jelszava fixen be van állítva.' });
  }

  const passwordOk = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  return res.json({ message: 'Current password verified' });
});

authRouter.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const user = await UserModel.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.isSystemAdmin) {
    return res.status(403).json({ message: 'A rendszer admin jelszava fixen be van állítva.' });
  }

  const passwordOk = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  user.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await user.save();

  return res.json({ message: 'Password updated successfully' });
});
