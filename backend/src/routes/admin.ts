import { Router } from 'express';
import { isChatThreadClosedStatus } from '../chat-thread-status';
import { getChatRetentionCutoff } from '../chat-retention';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { ChatThreadModel } from '../models/ChatThread';
import { PalinkaModel } from '../models/Palinka';
import { UserModel } from '../models/User';
import { createPalinkaHistoryEntry } from '../palinka-history';
import { adminUpdateUserSchema, transferPalinkaOwnershipSchema } from '../validation/admin';

export const adminRouter = Router();

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

const serializeAdminUser = (
  user: any,
  stats: { ownedPalinkaCount?: number; activeInterestCount?: number } = {}
) => ({
  id: getId(user),
  username: user.username,
  displayName: user.displayName ?? user.username,
  role: user.role,
  isSystemAdmin: !!user.isSystemAdmin,
  isDisabled: !!user.isDisabled,
  createdAt: user.createdAt,
  ownedPalinkaCount: stats.ownedPalinkaCount ?? 0,
  activeInterestCount: stats.activeInterestCount ?? 0,
});

const buildUserStats = async () => {
  const [ownedCounts, activeInterestCounts] = await Promise.all([
    PalinkaModel.aggregate([{ $group: { _id: '$ownerId', count: { $sum: 1 } } }]),
    ChatThreadModel.aggregate([
      {
        $match: {
          latestMessageAt: { $gte: getChatRetentionCutoff() },
          status: { $nin: ['closed', 'rejected'] },
        },
      },
      {
        $project: {
          userIds: ['$ownerId', '$requesterId'],
        },
      },
      { $unwind: '$userIds' },
      { $group: { _id: '$userIds', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    ownedByUserId: new Map(ownedCounts.map((entry) => [getId(entry._id), entry.count as number])),
    activeInterestsByUserId: new Map(activeInterestCounts.map((entry) => [getId(entry._id), entry.count as number])),
  };
};

const buildSingleUserStats = async (userId: string) => {
  const [ownedPalinkaCount, activeInterestCount] = await Promise.all([
    PalinkaModel.countDocuments({ ownerId: userId }),
    ChatThreadModel.countDocuments({
      latestMessageAt: { $gte: getChatRetentionCutoff() },
      status: { $nin: ['closed', 'rejected'] },
      $or: [{ ownerId: userId }, { requesterId: userId }],
    }),
  ]);

  return { ownedPalinkaCount, activeInterestCount };
};

const ensureAnotherActiveAdmin = async (userId: string) => {
  const remainingAdminCount = await UserModel.countDocuments({
    _id: { $ne: userId },
    role: 'admin',
    isDisabled: { $ne: true },
  });

  return remainingAdminCount > 0;
};

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/users', async (_req, res) => {
  const [users, stats] = await Promise.all([UserModel.find({}).sort({ createdAt: 1 }).lean(), buildUserStats()]);

  const serialized = users
    .map((user) =>
      serializeAdminUser(user, {
        ownedPalinkaCount: stats.ownedByUserId.get(getId(user)) ?? 0,
        activeInterestCount: stats.activeInterestsByUserId.get(getId(user)) ?? 0,
      })
    )
    .sort((left, right) => {
      const systemAdminDiff = Number(right.isSystemAdmin) - Number(left.isSystemAdmin);
      if (systemAdminDiff !== 0) {
        return systemAdminDiff;
      }

      const activeAdminDiff = Number(right.role === 'admin' && !right.isDisabled) - Number(left.role === 'admin' && !left.isDisabled);
      if (activeAdminDiff !== 0) {
        return activeAdminDiff;
      }

      if (left.isDisabled !== right.isDisabled) {
        return Number(left.isDisabled) - Number(right.isDisabled);
      }

      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });

  return res.json({ users: serialized });
});

adminRouter.patch('/users/:id', async (req: AuthenticatedRequest, res) => {
  const parsed = adminUpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const user = await UserModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (getId(user) === req.userId) {
    return res.status(403).json({ message: 'A saját admin fiókodat itt nem módosíthatod.' });
  }

  if (user.isSystemAdmin) {
    return res.status(403).json({ message: 'A rendszer admin fiókja nem módosítható.' });
  }

  const nextRole = parsed.data.role ?? user.role;
  const nextDisabled = parsed.data.isDisabled ?? !!user.isDisabled;
  const removesActiveAdmin = user.role === 'admin' && (!nextRole || nextRole !== 'admin' || nextDisabled);

  if (removesActiveAdmin && !(await ensureAnotherActiveAdmin(getId(user)))) {
    return res.status(409).json({ message: 'Legalább egy aktív admin felhasználónak maradnia kell.' });
  }

  user.role = nextRole;
  user.isDisabled = nextDisabled;
  await user.save();

  return res.json({ user: serializeAdminUser(user, await buildSingleUserStats(getId(user))) });
});

adminRouter.post('/users/:id/transfer-palinkas', async (req: AuthenticatedRequest, res) => {
  const parsed = transferPalinkaOwnershipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const [sourceUser, targetUser, actor] = await Promise.all([
    UserModel.findById(req.params.id),
    UserModel.findById(parsed.data.targetUserId),
    UserModel.findById(req.userId).select('username displayName').lean(),
  ]);

  if (!sourceUser) {
    return res.status(404).json({ message: 'Forrás felhasználó nem található.' });
  }

  if (!targetUser) {
    return res.status(404).json({ message: 'Cél felhasználó nem található.' });
  }

  if (getId(sourceUser) === getId(targetUser)) {
    return res.status(400).json({ message: 'A forrás és a cél felhasználó nem lehet ugyanaz.' });
  }

  if (targetUser.isDisabled) {
    return res.status(400).json({ message: 'Letiltott felhasználóhoz nem adható át tulajdon.' });
  }

  const palinkas = await PalinkaModel.find({ ownerId: sourceUser._id }).select('_id name').lean();
  if (palinkas.length === 0) {
    return res.json({
      transferredCount: 0,
      sourceUser: serializeUserSummary(sourceUser),
      targetUser: serializeUserSummary(targetUser),
      message: 'A kiválasztott felhasználónak nincs átadható tétele.',
    });
  }

  const duplicateNames = await PalinkaModel.find({
    ownerId: targetUser._id,
    name: { $in: palinkas.map((palinka) => palinka.name) },
  })
    .select('name')
    .lean();

  if (duplicateNames.length > 0) {
    return res.status(409).json({
      message: 'A cél felhasználónál már léteznek azonos nevű tételek.',
      duplicateNames: duplicateNames.map((item) => item.name),
    });
  }

  const sourceLabel = sourceUser.displayName ?? sourceUser.username;
  const targetLabel = targetUser.displayName ?? targetUser.username;
  const historyActor = {
    id: actor?._id ?? req.userId,
    username: actor?.username ?? 'admin',
    displayName: actor?.displayName ?? actor?.username ?? 'Admin',
  };

  await Promise.all(
    palinkas.map((palinka) =>
      PalinkaModel.updateOne(
        { _id: palinka._id },
        {
          $set: { ownerId: targetUser._id },
          $push: {
            history: createPalinkaHistoryEntry({
              type: 'updated',
              actor: historyActor,
              title: 'Tulajdon átruházva',
              description: `${sourceLabel} -> ${targetLabel}`,
              changedFields: ['ownerId'],
            }),
          },
        }
      )
    )
  );

  await ChatThreadModel.updateMany(
    { palinkaId: { $in: palinkas.map((palinka) => palinka._id) } },
    { $set: { ownerId: targetUser._id } }
  );

  return res.json({
    transferredCount: palinkas.length,
    sourceUser: serializeUserSummary(sourceUser),
    targetUser: serializeUserSummary(targetUser),
    message: `${palinkas.length} tétel tulajdona átkerült a kijelölt felhasználóhoz.`,
  });
});