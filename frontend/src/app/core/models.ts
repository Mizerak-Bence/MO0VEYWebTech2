export const PALINKA_STATUS_VALUES = ['active', 'reserved', 'partial', 'exhausted', 'archived'] as const;

export type PalinkaStatus = (typeof PALINKA_STATUS_VALUES)[number];

export const CHAT_INTEREST_STATUS_VALUES = ['new_interest', 'contacted', 'negotiating', 'closed', 'rejected'] as const;

export type ChatInterestStatus = (typeof CHAT_INTEREST_STATUS_VALUES)[number];

export const CHAT_INTEREST_STATUS_LABELS: Record<ChatInterestStatus, string> = {
  new_interest: 'Új érdeklődés',
  contacted: 'Kapcsolatfelvétel',
  negotiating: 'Egyeztetés alatt',
  closed: 'Lezárva',
  rejected: 'Elutasítva',
};

export const CHAT_INTEREST_STATUS_DESCRIPTIONS: Record<ChatInterestStatus, string> = {
  new_interest: 'Még nincs visszajelzés a tulajdonostól.',
  contacted: 'A tulajdonos már felvette a kapcsolatot.',
  negotiating: 'A felek aktívan egyeztetnek.',
  closed: 'A folyamat lezárult.',
  rejected: 'Az érdeklődés elutasítva vagy megszakítva.',
};

export const isClosedChatInterestStatus = (status: ChatInterestStatus) => status === 'closed' || status === 'rejected';

export type LoginRequest = {
  username: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  displayName?: string;
  password: string;
};

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  isSystemAdmin?: boolean;
  isDisabled: boolean;
  createdAt: string;
};

export type UserSummary = {
  id: string;
  username: string;
  displayName: string;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};

export type AdminUserSummary = UserProfile & {
  ownedPalinkaCount: number;
  activeInterestCount: number;
};

export type UpdateAdminUserRequest = {
  role?: 'user' | 'admin';
  isDisabled?: boolean;
};

export type TransferPalinkaOwnershipRequest = {
  targetUserId: string;
};

export type TransferPalinkaOwnershipResponse = {
  transferredCount: number;
  sourceUser: UserSummary;
  targetUser: UserSummary;
  message: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type VerifyCurrentPasswordRequest = {
  currentPassword: string;
};

export type UpdateProfileRequest = {
  displayName: string;
};

export type Palinka = {
  id: string;
  ownerId?: string;
  owner?: UserSummary | null;
  name: string;
  fruitType: string;
  abvPercent: number | null;
  volumeLiters: number;
  volumeMinLiters?: number | null;
  volumeMaxLiters?: number | null;
  containerCapacityLiters?: number | null;
  status: PalinkaStatus;
  distillationStyle: string;
  madeDate: string | null;
  notes: string | null;
  createdAt: string;
  isOwnedByCurrentUser?: boolean;
  canManage?: boolean;
  currentUserHasConversation?: boolean;
  interestCount?: number;
  interestEntries?: PalinkaInterestEntry[];
  history?: PalinkaHistoryEntry[];
};

export type PalinkaHistoryEntry = {
  id: string;
  type: 'created' | 'updated' | 'interest_received' | 'status_changed';
  title: string;
  description: string | null;
  actorDisplayName: string;
  actorUsername: string | null;
  changedFields: string[];
  status: PalinkaStatus | null;
  createdAt: string;
};

export type PalinkaInterestEntry = {
  requester: UserSummary;
  latestMessageAt: string;
  expiresAt: string;
  status: ChatInterestStatus;
};

export type ChatMessage = {
  id: string;
  text: string;
  createdAt: string;
  sender: UserSummary;
  isOwnMessage: boolean;
};

export type ChatThread = {
  id: string;
  palinka: {
    id: string;
    fruitType: string;
    distillationStyle: string;
    volumeLiters: number;
  } | null;
  owner: UserSummary;
  requester: UserSummary;
  status: ChatInterestStatus;
  latestMessageAt: string;
  isOwnerView: boolean;
  canManageWorkflow?: boolean;
  unreadCount: number;
  seenAt: string | null;
  messages: ChatMessage[];
};

export type CreatePalinkaRequest = {
  fruitType: string;
  abvPercent?: number;
  volumeLiters: number;
  volumeMinLiters?: number;
  volumeMaxLiters?: number;
  containerCapacityLiters?: number;
  status: PalinkaStatus;
  distillationStyle: string;
  madeDate?: string;
  notes?: string;
};

export type UpdatePalinkaRequest = CreatePalinkaRequest;
