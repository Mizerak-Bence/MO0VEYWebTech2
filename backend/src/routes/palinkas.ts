import { Router } from 'express';
import { isChatThreadClosedStatus, normalizeChatThreadStatus } from '../chat-thread-status';
import { PalinkaModel } from '../models/Palinka';
import { UserModel } from '../models/User';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { createPalinkaSchema, updatePalinkaStateSchema } from '../validation/palinka';
import { buildPalinkaName } from '../palinka-name';
import { ChatThreadModel } from '../models/ChatThread';
import { getChatRetentionCutoff, getChatThreadExpiresAt } from '../chat-retention';
import { getPalinkaStatusLabel, normalizePalinkaStatus } from '../palinka-status';
import {
  createPalinkaHistoryEntry,
  describePalinkaStatusChange,
  palinkaHistoryComparableFields,
} from '../palinka-history';

export const palinkasRouter = Router();

const getId = (value: any) =>
  value?._id?.toHexString?.() ??
  value?._id?.toString?.() ??
  value?.toHexString?.() ??
  value?.id ??
  value?.toString?.() ??
  '';

const serializeUserSummary = (user: any) => ({
  id: getId(user),
  username: user?.username ?? '',
  displayName: user?.displayName ?? user?.username ?? '',
});

const serializeHistoryEntry = (entry: any) => ({
  id: getId(entry?._id),
  type: entry?.type,
  title: entry?.title ?? '',
  description: entry?.description ?? null,
  actorDisplayName: entry?.actorDisplayName ?? 'Ismeretlen felhasználó',
  actorUsername: entry?.actorUsername ?? null,
  changedFields: entry?.changedFields ?? [],
  status: entry?.status ?? null,
  createdAt: entry?.createdAt,
});

const buildFallbackHistoryEntries = (palinka: any) => {
  if (!palinka?.createdAt) {
    return [];
  }

  return [
    {
      id: `legacy-${getId(palinka?._id)}`,
      type: 'created',
      title: 'Tétel korábban létrehozva',
      description: 'Eredeti létrehozási esemény az audit trail bevezetése előttről.',
      actorDisplayName: palinka?.ownerId?.displayName ?? palinka?.ownerId?.username ?? 'Ismeretlen felhasználó',
      actorUsername: palinka?.ownerId?.username ?? null,
      changedFields: [],
      status: normalizePalinkaStatus(palinka?.status),
      createdAt: palinka.createdAt,
    },
  ];
};

const getComparableValue = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
};

const getChangedFields = (current: Record<string, unknown>, next: Record<string, unknown>) =>
  palinkaHistoryComparableFields.filter(
    (field) => getComparableValue(current[field]) !== getComparableValue(next[field])
  );

const loadHistoryActor = async (userId: string) => {
  const user = await UserModel.findById(userId).select('username displayName').lean();

  return {
    id: user?._id ?? userId,
    username: user?.username ?? '',
    displayName: user?.displayName ?? user?.username ?? 'Ismeretlen felhasználó',
  };
};

const activeThreadFilter = () => ({ latestMessageAt: { $gte: getChatRetentionCutoff() } });

const purgeExpiredThreads = () => ChatThreadModel.deleteMany({ latestMessageAt: { $lt: getChatRetentionCutoff() } });

const hasExpiredWorkflowClosure = (workflowClosedAt: Date | string | null | undefined) => {
  if (!workflowClosedAt) {
    return false;
  }

  return new Date(workflowClosedAt).getTime() < getChatRetentionCutoff().getTime();
};

const normalizePayload = (input: Record<string, unknown>) => {
  const body = { ...input } as Record<string, unknown>;

  if (typeof body.abvPercent === 'string') body.abvPercent = Number(body.abvPercent);
  if (typeof body.volumeLiters === 'string') body.volumeLiters = Number(body.volumeLiters);
  if (typeof body.volumeMinLiters === 'string') body.volumeMinLiters = Number(body.volumeMinLiters);
  if (typeof body.volumeMaxLiters === 'string') body.volumeMaxLiters = Number(body.volumeMaxLiters);
  if (typeof body.containerCapacityLiters === 'string') body.containerCapacityLiters = Number(body.containerCapacityLiters);

  return body;
};

const serializePalinka = (p: any, options?: { includeHistory?: boolean }) => {
  const includeHistory = !!options?.includeHistory;
  const serializedHistory = includeHistory
    ? (Array.isArray(p.history) && p.history.length > 0
        ? [...p.history]
            .map((entry) => serializeHistoryEntry(entry))
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        : buildFallbackHistoryEntries(p))
    : undefined;

  return {
    id: getId(p._id),
    ownerId: getId(p.ownerId),
    name: p.name,
    fruitType: p.fruitType,
    abvPercent: p.abvPercent ?? null,
    volumeLiters: p.volumeLiters,
    volumeMinLiters: p.volumeMinLiters ?? null,
    volumeMaxLiters: p.volumeMaxLiters ?? null,
    containerCapacityLiters: p.containerCapacityLiters ?? null,
    status: normalizePalinkaStatus(p.status),
    distillationStyle: p.distillationStyle,
    madeDate: p.madeDate ?? null,
    notes: p.notes ?? null,
    workflowClosedAt: p.workflowClosedAt ?? null,
    createdAt: p.createdAt,
    history: serializedHistory,
  };
};

const manageFilter = (req: AuthenticatedRequest) =>
  req.userRole === 'admin' ? {} : { ownerId: req.userId! };

const withOwnerAndChatMeta = async (
  items: any[],
  currentUserId: string,
  currentUserRole: 'user' | 'admin',
  includeHistory = false
) => {
  const visibleItems = items.filter((item) => !hasExpiredWorkflowClosure(item.workflowClosedAt));
  const palinkaIds = visibleItems.map((item) => item._id);

  await purgeExpiredThreads();

  const threads = palinkaIds.length
    ? await ChatThreadModel.find({ palinkaId: { $in: palinkaIds }, ...activeThreadFilter() })
        .select('palinkaId requesterId latestMessageAt status')
        .populate('requesterId', 'username displayName')
        .lean()
    : [];

  const interestCountByPalinka = new Map<string, number>();
  const currentUserConversationIds = new Set<string>();
  const interestEntriesByPalinka = new Map<string, any[]>();

  for (const thread of threads) {
    const palinkaId = thread.palinkaId.toString();
    const normalizedStatus = normalizeChatThreadStatus(thread.status);
    if (!isChatThreadClosedStatus(normalizedStatus)) {
      interestCountByPalinka.set(palinkaId, (interestCountByPalinka.get(palinkaId) ?? 0) + 1);
    }
    if (getId(thread.requesterId) === currentUserId) {
      currentUserConversationIds.add(palinkaId);
    }

    const currentEntries = interestEntriesByPalinka.get(palinkaId) ?? [];
    currentEntries.push({
      requester: serializeUserSummary(thread.requesterId),
      latestMessageAt: thread.latestMessageAt,
      expiresAt: getChatThreadExpiresAt(thread.latestMessageAt),
      status: normalizedStatus,
    });
    interestEntriesByPalinka.set(palinkaId, currentEntries);
  }

  return visibleItems
    .map((item) => {
      const serialized = serializePalinka(item, { includeHistory });
      const owner = item.ownerId && typeof item.ownerId === 'object'
        ? {
            id: getId(item.ownerId),
            username: item.ownerId.username,
            displayName: item.ownerId.displayName ?? item.ownerId.username,
          }
        : null;

      const interestEntries = (interestEntriesByPalinka.get(serialized.id) ?? []).sort(
        (left, right) => new Date(right.latestMessageAt).getTime() - new Date(left.latestMessageAt).getTime()
      );
      const canSeeInterestIdentities = currentUserRole === 'admin';

      return {
        ...serialized,
        owner,
        isOwnedByCurrentUser: serialized.ownerId === currentUserId,
        canManage: currentUserRole === 'admin' || serialized.ownerId === currentUserId,
        currentUserHasConversation: currentUserConversationIds.has(serialized.id),
        interestCount: interestCountByPalinka.get(serialized.id) ?? 0,
        interestEntries: interestEntries.map((entry) => ({
          ...entry,
          requester: canSeeInterestIdentities ? entry.requester : null,
        })),
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

const loadSerializedPalinkaForUser = async (
  palinkaId: string,
  req: AuthenticatedRequest,
  includeHistory = false
) => {
  const item = await PalinkaModel.findById(palinkaId).populate('ownerId', 'username displayName').lean();
  if (!item) {
    return null;
  }

  const [serialized] = await withOwnerAndChatMeta([item], req.userId!, req.userRole!, includeHistory);
  return serialized ?? null;
};

palinkasRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const items = await PalinkaModel.find({}).select('-history').populate('ownerId', 'username displayName').lean();

  return res.json(await withOwnerAndChatMeta(items, req.userId!, req.userRole!));
});

palinkasRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const serialized = await loadSerializedPalinkaForUser(String(req.params.id), req, true);
  if (!serialized) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

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
  const status = normalizePalinkaStatus(parsed.data.status);
  const name = buildPalinkaName({
    ...parsed.data,
    madeDate,
  });
  const actor = await loadHistoryActor(req.userId!);

  try {
    const created = await PalinkaModel.create({
      ownerId,
      ...parsed.data,
      status,
      name,
      madeDate,
      history: [
        createPalinkaHistoryEntry({
          type: 'created',
          actor,
          title: 'Tétel létrehozva',
          description: `Kezdeti állapot: ${getPalinkaStatusLabel(status)}.`,
          status,
        }),
      ],
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
  const status = normalizePalinkaStatus(parsed.data.status);
  const name = buildPalinkaName({
    ...parsed.data,
    madeDate,
  });
  const current = await PalinkaModel.findOne({ _id: req.params.id, ...manageFilter(req) });

  if (!current) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  const nextValues = {
    fruitType: parsed.data.fruitType,
    abvPercent: parsed.data.abvPercent ?? undefined,
    volumeLiters: parsed.data.volumeLiters,
    volumeMinLiters: parsed.data.volumeMinLiters ?? undefined,
    volumeMaxLiters: parsed.data.volumeMaxLiters ?? undefined,
    containerCapacityLiters: parsed.data.containerCapacityLiters ?? undefined,
    status,
    distillationStyle: parsed.data.distillationStyle,
    madeDate,
    notes: parsed.data.notes ?? undefined,
    name,
  };

  const changedFields = getChangedFields(current.toObject() as Record<string, unknown>, nextValues as Record<string, unknown>);

  if (changedFields.length === 0) {
    const serialized = await loadSerializedPalinkaForUser(String(req.params.id), req, true);
    if (!serialized) {
      return res.status(404).json({ message: 'Palinka not found' });
    }

    return res.json(serialized);
  }

  const actor = await loadHistoryActor(req.userId!);
  const nonStatusFields = changedFields.filter((field) => field !== 'status');
  const previousStatus = normalizePalinkaStatus(current.status);

  try {
    Object.assign(current, nextValues);

    if (nonStatusFields.length > 0) {
      current.history.push(
        createPalinkaHistoryEntry({
          type: 'updated',
          actor,
          title: 'Tétel módosítva',
          description: 'A tétel adatai frissítve lettek.',
          changedFields: nonStatusFields,
        }) as any
      );
    }

    if (changedFields.includes('status')) {
      current.history.push(
        createPalinkaHistoryEntry({
          type: 'status_changed',
          actor,
          title: 'Állapot módosítva',
          description: describePalinkaStatusChange(previousStatus, status),
          status,
        }) as any
      );
    }

    await current.save();

    const serialized = await loadSerializedPalinkaForUser(String(req.params.id), req, true);
    if (!serialized) {
      return res.status(404).json({ message: 'Palinka not found' });
    }

    return res.json(serialized);
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Ilyen tétel már létezik.' });
    }
    throw err;
  }
});

palinkasRouter.patch('/:id/state', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = updatePalinkaStateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const current = await PalinkaModel.findOne({ _id: req.params.id, ...manageFilter(req) });
  if (!current) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  const actor = await loadHistoryActor(req.userId!);
  const nextState = parsed.data.state;
  let shouldSave = false;

  if (nextState === 'closed') {
    if (!current.workflowClosedAt) {
      current.workflowClosedAt = new Date();
      current.workflowClosedThreadId = undefined as any;
      current.history.push(
        createPalinkaHistoryEntry({
          type: 'updated',
          actor,
          title: 'Tétel lezárva',
          description: 'A tétel kézi lezárással lezárt állapotba került.',
        }) as any
      );
      shouldSave = true;
    }
  } else {
    const nextStatus = normalizePalinkaStatus(nextState);
    const previousStatus = normalizePalinkaStatus(current.status);
    const wasClosed = !!current.workflowClosedAt;
    const statusChanged = previousStatus !== nextStatus;

    if (wasClosed || statusChanged) {
      current.status = nextStatus;
      current.workflowClosedAt = undefined;
      current.workflowClosedThreadId = undefined as any;
      current.history.push(
        createPalinkaHistoryEntry({
          type: 'status_changed',
          actor,
          title: wasClosed ? 'Tétel újranyitva' : 'Állapot módosítva',
          description: `${wasClosed ? 'Lezárva' : getPalinkaStatusLabel(previousStatus)} -> ${getPalinkaStatusLabel(nextStatus)}`,
          status: nextStatus,
        }) as any
      );
      shouldSave = true;
    }
  }

  if (shouldSave) {
    await current.save();
  }

  const serialized = await loadSerializedPalinkaForUser(String(req.params.id), req, true);
  if (!serialized) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  return res.json(serialized);
});

palinkasRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const deleted = await PalinkaModel.findOneAndDelete({ _id: req.params.id, ...manageFilter(req) }).lean();

  if (!deleted) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  return res.status(204).send();
});
