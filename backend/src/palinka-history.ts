import { getPalinkaStatusLabel, type PalinkaStatus } from './palinka-status';

export const palinkaHistoryEventTypeValues = [
  'created',
  'updated',
  'interest_received',
  'interest_status_changed',
  'status_changed',
] as const;

export type PalinkaHistoryEventType = (typeof palinkaHistoryEventTypeValues)[number];

export const palinkaHistoryComparableFields = [
  'ownerId',
  'fruitType',
  'abvPercent',
  'volumeLiters',
  'volumeMinLiters',
  'volumeMaxLiters',
  'containerCapacityLiters',
  'status',
  'distillationStyle',
  'madeDate',
  'notes',
] as const;

export type PalinkaHistoryComparableField = (typeof palinkaHistoryComparableFields)[number];

type PalinkaHistoryActor = {
  id?: unknown;
  username?: string;
  displayName?: string | null;
};

type CreatePalinkaHistoryEntryInput = {
  type: PalinkaHistoryEventType;
  actor: PalinkaHistoryActor;
  title: string;
  description?: string;
  changedFields?: PalinkaHistoryComparableField[];
  status?: PalinkaStatus;
  createdAt?: Date;
};

const fieldLabels: Record<PalinkaHistoryComparableField, string> = {
  ownerId: 'Tulajdonos',
  fruitType: 'Gyümölcs',
  abvPercent: 'Alkoholfok',
  volumeLiters: 'Mennyiség',
  volumeMinLiters: 'Minimum mennyiség',
  volumeMaxLiters: 'Maximum mennyiség',
  containerCapacityLiters: 'Tároló mérete',
  status: 'Állapot',
  distillationStyle: 'Főzés',
  madeDate: 'Készítés dátuma',
  notes: 'Megjegyzés',
};

export const getPalinkaChangedFieldLabels = (fields: PalinkaHistoryComparableField[]) =>
  fields.map((field) => fieldLabels[field]);

export const describePalinkaStatusChange = (from: PalinkaStatus, to: PalinkaStatus) =>
  `${getPalinkaStatusLabel(from)} -> ${getPalinkaStatusLabel(to)}`;

export const createPalinkaHistoryEntry = ({
  type,
  actor,
  title,
  description,
  changedFields = [],
  status,
  createdAt = new Date(),
}: CreatePalinkaHistoryEntryInput) => ({
  type,
  actorId: actor.id,
  actorDisplayName: actor.displayName ?? actor.username ?? 'Ismeretlen felhasználó',
  actorUsername: actor.username ?? undefined,
  title,
  description: description?.trim() || undefined,
  changedFields: getPalinkaChangedFieldLabels(changedFields),
  status,
  createdAt,
});