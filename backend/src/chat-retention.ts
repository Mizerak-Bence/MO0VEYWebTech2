export const CHAT_THREAD_RETENTION_DAYS = 7;
export const CHAT_THREAD_RETENTION_MS = CHAT_THREAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const CHAT_THREAD_RETENTION_SECONDS = Math.floor(CHAT_THREAD_RETENTION_MS / 1000);

export const getChatRetentionCutoff = (now = new Date()) => new Date(now.getTime() - CHAT_THREAD_RETENTION_MS);

export const getChatThreadExpiresAt = (latestMessageAt: Date | string) =>
  new Date(new Date(latestMessageAt).getTime() + CHAT_THREAD_RETENTION_MS);