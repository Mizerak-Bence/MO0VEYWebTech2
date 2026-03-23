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
  distillationStyle: string;
  madeDate: string | null;
  notes: string | null;
  createdAt: string;
  isOwnedByCurrentUser?: boolean;
  canManage?: boolean;
  currentUserHasConversation?: boolean;
  interestCount?: number;
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
  status: 'requested' | 'open';
  latestMessageAt: string;
  isOwnerView: boolean;
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
  distillationStyle: string;
  madeDate?: string;
  notes?: string;
};

export type UpdatePalinkaRequest = CreatePalinkaRequest;
