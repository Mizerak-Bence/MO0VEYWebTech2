import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { ChatThreadModel } from '../models/ChatThread';
import { PalinkaModel } from '../models/Palinka';
import { UserModel } from '../models/User';
import {
  getAutoAdvancedChatThreadStatus,
  getChatThreadStatusLabel,
  isChatThreadClosedStatus,
  normalizeChatThreadStatus,
} from '../chat-thread-status';
import { getChatRetentionCutoff } from '../chat-retention';
import { normalizePalinkaStatus, palinkaAllowsNewInterest } from '../palinka-status';
import { createPalinkaHistoryEntry } from '../palinka-history';
import { reservePalinkaSchema, sendChatMessageSchema, updateChatThreadStatusSchema } from '../validation/chat';

export const chatsRouter = Router();

const threadAccessFilter = (req: AuthenticatedRequest) =>
  req.userRole === 'admin'
    ? {}
    : {
        $or: [{ ownerId: req.userId! }, { requesterId: req.userId! }],
      };

const activeThreadFilter = () => ({ latestMessageAt: { $gte: getChatRetentionCutoff() } });

const purgeExpiredThreads = () => ChatThreadModel.deleteMany({ latestMessageAt: { $lt: getChatRetentionCutoff() } });

const loadHistoryActor = async (userId: string) => {
  const user = await UserModel.findById(userId).select('username displayName').lean();

  return {
    id: user?._id ?? userId,
    username: user?.username ?? '',
    displayName: user?.displayName ?? user?.username ?? 'Ismeretlen felhasználó',
  };
};

const canManageThreadWorkflow = (req: AuthenticatedRequest, thread: any) =>
  req.userRole === 'admin' || getUserId(thread.ownerId) === req.userId;

const appendInterestStatusHistory = async (thread: any, actorUserId: string, fromStatus: unknown, toStatus: unknown) => {
  const previousStatus = normalizeChatThreadStatus(fromStatus);
  const nextStatus = normalizeChatThreadStatus(toStatus);

  if (previousStatus === nextStatus) {
    return;
  }

  const actor = await loadHistoryActor(actorUserId);
  const requester = await loadHistoryActor(getUserId(thread.requesterId));

  await PalinkaModel.updateOne(
    { _id: thread.palinkaId },
    {
      $push: {
        history: createPalinkaHistoryEntry({
          type: 'interest_status_changed',
          actor,
          title: 'Érdeklődési állapot módosítva',
          description: `${requester.displayName}: ${getChatThreadStatusLabel(previousStatus)} -> ${getChatThreadStatusLabel(nextStatus)}.`,
        }),
      },
    }
  );
};

const serializeUserSummary = (user: any) => ({
  id: user?._id?.toHexString?.() ?? user?._id?.toString?.() ?? user?.id ?? '',
  username: user?.username ?? '',
  displayName: user?.displayName ?? user?.username ?? '',
});

const getUserId = (value: any) =>
  value?._id?.toHexString?.() ?? value?._id?.toString?.() ?? value?.toHexString?.() ?? value?.id ?? value?.toString?.() ?? '';

const getSeenFieldName = (thread: any, currentUserId: string) =>
  getUserId(thread.ownerId) === currentUserId ? 'ownerSeenAt' : 'requesterSeenAt';

const countUnreadMessages = (thread: any, currentUserId: string) => {
  const seenFieldName = getSeenFieldName(thread, currentUserId);
  const seenAt = thread[seenFieldName] ? new Date(thread[seenFieldName]).getTime() : 0;

  return (thread.messages ?? []).filter((message: any) => {
    const senderId = getUserId(message.senderId);
    const createdAt = new Date(message.createdAt).getTime();
    return senderId !== currentUserId && createdAt > seenAt;
  }).length;
};

const serializeThread = (thread: any, currentUserId: string, currentUserRole: 'user' | 'admin') => ({
  id: thread._id.toString(),
  palinka: thread.palinkaId
    ? {
        id: getUserId(thread.palinkaId),
        fruitType: thread.palinkaId.fruitType,
        distillationStyle: thread.palinkaId.distillationStyle,
        volumeLiters: thread.palinkaId.volumeLiters,
      }
    : null,
  owner: serializeUserSummary(thread.ownerId),
  requester: serializeUserSummary(thread.requesterId),
  status: normalizeChatThreadStatus(thread.status),
  latestMessageAt: thread.latestMessageAt,
  isOwnerView: getUserId(thread.ownerId) === currentUserId,
  canManageWorkflow: currentUserRole === 'admin' || getUserId(thread.ownerId) === currentUserId,
  unreadCount: countUnreadMessages(thread, currentUserId),
  seenAt: thread[getSeenFieldName(thread, currentUserId)] ?? null,
  messages: (thread.messages ?? []).map((message: any) => ({
    id: message._id.toString(),
    text: message.text,
    createdAt: message.createdAt,
    sender: serializeUserSummary(message.senderId),
    isOwnMessage: getUserId(message.senderId) === currentUserId,
  })),
});

chatsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  await purgeExpiredThreads();

  const threads = await ChatThreadModel.find({ ...threadAccessFilter(req), ...activeThreadFilter() })
    .sort({ latestMessageAt: -1 })
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.json(threads.map((thread) => serializeThread(thread, req.userId!, req.userRole!)));
});

chatsRouter.post('/reserve', requireAuth, async (req: AuthenticatedRequest, res) => {
  await purgeExpiredThreads();

  const parsed = reservePalinkaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const palinka = await PalinkaModel.findById(parsed.data.palinkaId).lean();
  if (!palinka) {
    return res.status(404).json({ message: 'Palinka not found' });
  }

  if (req.userRole !== 'admin' && palinka.ownerId.toString() === req.userId) {
    return res.status(400).json({ message: 'A saját tételedre nem tudsz foglalási beszélgetést indítani.' });
  }

  const palinkaStatus = normalizePalinkaStatus(palinka.status);

  let thread = await ChatThreadModel.findOne({
    palinkaId: palinka._id,
    requesterId: req.userId,
    ...activeThreadFilter(),
  });

  if (!thread && !palinkaAllowsNewInterest(palinkaStatus)) {
    return res.status(409).json({ message: 'Ehhez a tételhez az aktuális állapot miatt nem indítható új érdeklődés.' });
  }

  if (!thread) {
    thread = await ChatThreadModel.create({
      palinkaId: palinka._id,
      ownerId: palinka.ownerId,
      requesterId: req.userId!,
      status: 'new_interest',
      latestMessageAt: new Date(),
      messages: [
        {
          senderId: req.userId!,
          text:
            parsed.data.initialMessage?.trim() ||
            'Szia! Erre a tételre szeretnék érdeklődni / foglalási igényt jelezni.',
          createdAt: new Date(),
        },
      ],
      requesterSeenAt: new Date(),
    });

    const actor = await loadHistoryActor(req.userId!);
    await PalinkaModel.updateOne(
      { _id: palinka._id },
      {
        $push: {
          history: createPalinkaHistoryEntry({
            type: 'interest_received',
            actor,
            title: 'Új érdeklődő érkezett',
            description: 'Új foglalási vagy érdeklődési beszélgetés indult a tételhez.',
          }),
        },
      }
    );
  } else if (parsed.data.initialMessage?.trim()) {
    const previousStatus = normalizeChatThreadStatus(thread.status);
    thread.messages.push({ senderId: req.userId!, text: parsed.data.initialMessage.trim(), createdAt: new Date() } as any);
    thread.latestMessageAt = new Date();
    thread.status = getAutoAdvancedChatThreadStatus(previousStatus, canManageThreadWorkflow(req, thread));
    if (getUserId(thread.ownerId) === req.userId) {
      thread.ownerSeenAt = new Date();
    } else {
      thread.requesterSeenAt = new Date();
    }
    await thread.save();
    await appendInterestStatusHistory(thread, req.userId!, previousStatus, thread.status);
  }

  const populated = await ChatThreadModel.findById(thread._id)
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.status(201).json({ thread: serializeThread(populated, req.userId!, req.userRole!) });
});

chatsRouter.post('/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  await purgeExpiredThreads();

  const parsed = sendChatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const thread = await ChatThreadModel.findOne({ _id: req.params.id, ...threadAccessFilter(req), ...activeThreadFilter() });
  if (!thread) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  const previousStatus = normalizeChatThreadStatus(thread.status);
  if (isChatThreadClosedStatus(previousStatus)) {
    return res.status(409).json({ message: 'A lezárt vagy elutasított érdeklődéshez nem küldhető új üzenet.' });
  }

  thread.messages.push({ senderId: req.userId!, text: parsed.data.text, createdAt: new Date() } as any);
  thread.latestMessageAt = new Date();
  thread.status = getAutoAdvancedChatThreadStatus(previousStatus, canManageThreadWorkflow(req, thread));
  if (getUserId(thread.ownerId) === req.userId) {
    thread.ownerSeenAt = new Date();
  } else {
    thread.requesterSeenAt = new Date();
  }
  await thread.save();
  await appendInterestStatusHistory(thread, req.userId!, previousStatus, thread.status);

  const populated = await ChatThreadModel.findById(thread._id)
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.json({ thread: serializeThread(populated, req.userId!, req.userRole!) });
});

chatsRouter.post('/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  await purgeExpiredThreads();

  const parsed = updateChatThreadStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const thread = await ChatThreadModel.findOne({ _id: req.params.id, ...threadAccessFilter(req), ...activeThreadFilter() });
  if (!thread) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  if (!canManageThreadWorkflow(req, thread)) {
    return res.status(403).json({ message: 'Csak a tulajdonos vagy az admin módosíthatja az érdeklődés állapotát.' });
  }

  const previousStatus = normalizeChatThreadStatus(thread.status);
  const nextStatus = normalizeChatThreadStatus(parsed.data.status);

  if (previousStatus === nextStatus) {
    const populated = await ChatThreadModel.findById(thread._id)
      .populate('palinkaId')
      .populate('ownerId', 'username displayName')
      .populate('requesterId', 'username displayName')
      .populate('messages.senderId', 'username displayName')
      .lean();

    return res.json({ thread: serializeThread(populated, req.userId!, req.userRole!) });
  }

  thread.status = nextStatus;
  thread.latestMessageAt = new Date();
  await thread.save();
  await appendInterestStatusHistory(thread, req.userId!, previousStatus, nextStatus);

  const populated = await ChatThreadModel.findById(thread._id)
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.json({ thread: serializeThread(populated, req.userId!, req.userRole!) });
});

chatsRouter.post('/:id/seen', requireAuth, async (req: AuthenticatedRequest, res) => {
  await purgeExpiredThreads();

  const thread = await ChatThreadModel.findOne({ _id: req.params.id, ...threadAccessFilter(req), ...activeThreadFilter() });
  if (!thread) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  thread.status = normalizeChatThreadStatus(thread.status);

  if (getUserId(thread.ownerId) === req.userId) {
    thread.ownerSeenAt = new Date();
  } else {
    thread.requesterSeenAt = new Date();
  }
  await thread.save();

  const populated = await ChatThreadModel.findById(thread._id)
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.json({ thread: serializeThread(populated, req.userId!, req.userRole!) });
});