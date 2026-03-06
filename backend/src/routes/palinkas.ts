import { Router } from 'express';
import { PalinkaModel } from '../models/Palinka';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { createPalinkaSchema } from '../validation/palinka';

export const palinkasRouter = Router();

palinkasRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const ownerId = req.userId!;
  const items = await PalinkaModel.find({ ownerId }).sort({ createdAt: -1 }).lean();

  return res.json(
    items.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      fruitType: p.fruitType,
      abvPercent: p.abvPercent,
      volumeLiters: p.volumeLiters,
      distillationStyle: p.distillationStyle,
      madeDate: p.madeDate ?? null,
      notes: p.notes ?? null,
      createdAt: p.createdAt,
    }))
  );
});

palinkasRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const ownerId = req.userId!;

  const body = { ...req.body };
  if (typeof body.abvPercent === 'string') body.abvPercent = Number(body.abvPercent);
  if (typeof body.volumeLiters === 'string') body.volumeLiters = Number(body.volumeLiters);

  const parsed = createPalinkaSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const madeDate = parsed.data.madeDate ? new Date(parsed.data.madeDate) : undefined;

  try {
    const created = await PalinkaModel.create({
      ownerId,
      ...parsed.data,
      madeDate,
    });

    return res.status(201).json({ id: created._id.toString() });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Palinka with this name already exists' });
    }
    throw err;
  }
});
