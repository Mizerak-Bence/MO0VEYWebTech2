import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { ChatThreadModel } from '../models/ChatThread';
import { PalinkaModel } from '../models/Palinka';
import { reservePalinkaSchema, sendChatMessageSchema } from '../validation/chat';

export const chatsRouter = Router();

const threadAccessFilter = (req: AuthenticatedRequest) =>
  req.userRole === 'admin'
    ? {}
    : {
        $or: [{ ownerId: req.userId! }, { requesterId: req.userId! }],
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

const serializeThread = (thread: any, currentUserId: string) => ({
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
  status: thread.status,
  latestMessageAt: thread.latestMessageAt,
  isOwnerView: getUserId(thread.ownerId) === currentUserId,
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
  const threads = await ChatThreadModel.find(threadAccessFilter(req))
    .sort({ latestMessageAt: -1 })
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.json(threads.map((thread) => serializeThread(thread, req.userId!)));
});

chatsRouter.post('/reserve', requireAuth, async (req: AuthenticatedRequest, res) => {
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

  let thread = await ChatThreadModel.findOne({ palinkaId: palinka._id, requesterId: req.userId });

  if (!thread) {
    thread = await ChatThreadModel.create({
      palinkaId: palinka._id,
      ownerId: palinka.ownerId,
      requesterId: req.userId!,
      status: 'requested',
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
  } else if (parsed.data.initialMessage?.trim()) {
    thread.messages.push({ senderId: req.userId!, text: parsed.data.initialMessage.trim(), createdAt: new Date() } as any);
    thread.latestMessageAt = new Date();
    thread.status = 'open';
    if (getUserId(thread.ownerId) === req.userId) {
      thread.ownerSeenAt = new Date();
    } else {
      thread.requesterSeenAt = new Date();
    }
    await thread.save();
  }

  const populated = await ChatThreadModel.findById(thread._id)
    .populate('palinkaId')
    .populate('ownerId', 'username displayName')
    .populate('requesterId', 'username displayName')
    .populate('messages.senderId', 'username displayName')
    .lean();

  return res.status(201).json({ thread: serializeThread(populated, req.userId!) });
});

chatsRouter.post('/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = sendChatMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation error', issues: parsed.error.issues });
  }

  const thread = await ChatThreadModel.findOne({ _id: req.params.id, ...threadAccessFilter(req) });
  if (!thread) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  thread.messages.push({ senderId: req.userId!, text: parsed.data.text, createdAt: new Date() } as any);
  thread.latestMessageAt = new Date();
  thread.status = 'open';
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

  return res.json({ thread: serializeThread(populated, req.userId!) });
});

chatsRouter.post('/:id/seen', requireAuth, async (req: AuthenticatedRequest, res) => {
  const thread = await ChatThreadModel.findOne({ _id: req.params.id, ...threadAccessFilter(req) });
  if (!thread) {
    return res.status(404).json({ message: 'Conversation not found' });
  }

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

  return res.json({ thread: serializeThread(populated, req.userId!) });
});