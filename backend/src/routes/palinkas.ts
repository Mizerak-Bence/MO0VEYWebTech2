import { Router } from 'express';
import { PalinkaModel } from '../models/Palinka';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { createPalinkaSchema } from '../validation/palinka';
import { buildPalinkaName } from '../palinka-name';
import { ChatThreadModel } from '../models/ChatThread';

export const palinkasRouter = Router();

const getId = (value: any) =>
  value?._id?.toHexString?.() ??
  value?._id?.toString?.() ??
  value?.toHexString?.() ??
  value?.id ??
  value?.toString?.() ??
  '';

const normalizePayload = (input: Record<string, unknown>) => {
  const body = { ...input } as Record<string, unknown>;

  if (typeof body.abvPercent === 'string') body.abvPercent = Number(body.abvPercent);
  if (typeof body.volumeLiters === 'string') body.volumeLiters = Number(body.volumeLiters);
  if (typeof body.volumeMinLiters === 'string') body.volumeMinLiters = Number(body.volumeMinLiters);
  if (typeof body.volumeMaxLiters === 'string') body.volumeMaxLiters = Number(body.volumeMaxLiters);
  if (typeof body.containerCapacityLiters === 'string') body.containerCapacityLiters = Number(body.containerCapacityLiters);

  return body;
};

const serializePalinka = (p: any) => ({
  id: getId(p._id),
  ownerId: getId(p.ownerId),
  name: p.name,
  fruitType: p.fruitType,
  abvPercent: p.abvPercent ?? null,
  volumeLiters: p.volumeLiters,
  volumeMinLiters: p.volumeMinLiters ?? null,
  volumeMaxLiters: p.volumeMaxLiters ?? null,
  containerCapacityLiters: p.containerCapacityLiters ?? null,
  distillationStyle: p.distillationStyle,
  madeDate: p.madeDate ?? null,
  notes: p.notes ?? null,
  createdAt: p.createdAt,
});

const manageFilter = (req: AuthenticatedRequest) =>
  req.userRole === 'admin' ? {} : { ownerId: req.userId! };

const withOwnerAndChatMeta = async (items: any[], currentUserId: string, currentUserRole: 'user' | 'admin') => {
  const palinkaIds = items.map((item) => item._id);
  const threads = palinkaIds.length
    ? await ChatThreadModel.find({ palinkaId: { $in: palinkaIds } }).select('palinkaId requesterId').lean()
    : [];

  const interestCountByPalinka = new Map<string, number>();
  const currentUserConversationIds = new Set<string>();

  for (const thread of threads) {
    const palinkaId = thread.palinkaId.toString();
    interestCountByPalinka.set(palinkaId, (interestCountByPalinka.get(palinkaId) ?? 0) + 1);
    if (thread.requesterId.toString() === currentUserId) {
      currentUserConversationIds.add(palinkaId);
    }
  }

  return items
    .map((item) => {
      const serialized = serializePalinka(item);
      const owner = item.ownerId && typeof item.ownerId === 'object'
        ? {
            id: getId(item.ownerId),
            username: item.ownerId.username,
            displayName: item.ownerId.displayName ?? item.ownerId.username,
          }
        : null;

      return {
        ...serialized,
        owner,
        isOwnedByCurrentUser: serialized.ownerId === currentUserId,
        canManage: currentUserRole === 'admin' || serialized.ownerId === currentUserId,
        currentUserHasConversation: currentUserConversationIds.has(serialized.id),
        interestCount: interestCountByPalinka.get(serialized.id) ?? 0,
      };
    })
    .sort((left, right) => {
      const ownedDiff = Number(right.isOwnedByCurrentUser) - Number(left.isOwnedByCurrentUser);
      if (ownedDiff !== 0) {
        return ownedDiff;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
};

palinkasRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const items = await PalinkaModel.find({}).populate('ownerId', 'username displayName').lean();

  return res.json(await withOwnerAndChatMeta(items, req.userId!, req.userRole!));
});

palinkasRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const item = await PalinkaModel.findById(req.params.id).populate('ownerId', 'username displayName').lean();

  if (!item) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  const [serialized] = await withOwnerAndChatMeta([item], req.userId!, req.userRole!);
  return res.json(serialized);
});

palinkasRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const ownerId = req.userId!;

  const body = normalizePayload(req.body as Record<string, unknown>);

  const parsed = createPalinkaSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const madeDate = parsed.data.madeDate ? new Date(parsed.data.madeDate) : undefined;
  const name = buildPalinkaName({
    ...parsed.data,
    madeDate,
  });

  try {
    const created = await PalinkaModel.create({
      ownerId,
      ...parsed.data,
      name,
      madeDate,
    });

    return res.status(201).json({ id: created._id.toString() });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Ilyen tétel már létezik.' });
    }
    throw err;
  }
});

palinkasRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const body = normalizePayload(req.body as Record<string, unknown>);

  const parsed = createPalinkaSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const madeDate = parsed.data.madeDate ? new Date(parsed.data.madeDate) : undefined;
  const name = buildPalinkaName({
    ...parsed.data,
    madeDate,
  });

  try {
    const updated = await PalinkaModel.findOneAndUpdate(
      { _id: req.params.id, ...manageFilter(req) },
      {
        ...parsed.data,
        name,
        madeDate,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: 'Palinka not found' });
    }

    return res.json(serializePalinka(updated));
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Ilyen tétel már létezik.' });
    }
    throw err;
  }
});

palinkasRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const deleted = await PalinkaModel.findOneAndDelete({ _id: req.params.id, ...manageFilter(req) }).lean();

  if (!deleted) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  return res.status(204).send();
});
