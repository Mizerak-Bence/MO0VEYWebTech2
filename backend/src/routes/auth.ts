import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { config } from '../config';
import { loginSchema, registerSchema } from '../validation/auth';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const { username, password } = parsed.data;
  const existing = await UserModel.findOne({ username }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ username, passwordHash });

  return res.status(201).json({ id: user._id.toString(), username: user.username });
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

  const token = jwt.sign({ userId: user._id.toString() }, config.jwtSecret, { expiresIn: '8h' });
  return res.json({ token });
});
