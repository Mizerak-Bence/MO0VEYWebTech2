export const chatThreadStatusValues = ['new_interest', 'contacted', 'negotiating', 'closed', 'rejected'] as const;

export type ChatThreadStatus = (typeof chatThreadStatusValues)[number];

const legacyChatThreadStatusMap: Record<string, ChatThreadStatus> = {
  requested: 'new_interest',
  open: 'negotiating',
};

export const chatThreadStatusLabels: Record<ChatThreadStatus, string> = {
  new_interest: 'Új érdeklődés',
  contacted: 'Kapcsolatfelvétel',
  negotiating: 'Egyeztetés alatt',
  closed: 'Lezárva',
  rejected: 'Elutasítva',
};

export const chatThreadStatusDescriptions: Record<ChatThreadStatus, string> = {
  new_interest: 'A vevő jelezte az érdeklődését, de még nincs visszajelzés.',
  contacted: 'A tulajdonos már felvette a kapcsolatot az érdeklődővel.',
  negotiating: 'Aktív egyeztetés vagy ár/felvétel megbeszélés zajlik.',
  closed: 'Az érdeklődés sikeresen lezárult.',
  rejected: 'Az érdeklődést elutasították vagy megszakadt.',
};

export const normalizeChatThreadStatus = (status: unknown): ChatThreadStatus => {
  if (chatThreadStatusValues.includes(status as ChatThreadStatus)) {
    return status as ChatThreadStatus;
  }

  if (typeof status === 'string' && status in legacyChatThreadStatusMap) {
    return legacyChatThreadStatusMap[status];
  }

  return 'new_interest';
};

export const getChatThreadStatusLabel = (status: unknown) => chatThreadStatusLabels[normalizeChatThreadStatus(status)];

export const getChatThreadStatusDescription = (status: unknown) =>
  chatThreadStatusDescriptions[normalizeChatThreadStatus(status)];

export const isChatThreadClosedStatus = (status: unknown) => {
  const normalized = normalizeChatThreadStatus(status);
  return normalized === 'closed' || normalized === 'rejected';
};

export const getAutoAdvancedChatThreadStatus = (status: unknown, isManagerSender: boolean): ChatThreadStatus => {
  const normalized = normalizeChatThreadStatus(status);

  if (normalized === 'new_interest' && isManagerSender) {
    return 'contacted';
  }

  if (normalized === 'contacted' && !isManagerSender) {
    return 'negotiating';
  }

  return normalized;
};