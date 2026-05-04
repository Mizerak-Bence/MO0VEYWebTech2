export const palinkaStatusValues = ['active', 'reserved', 'partial', 'exhausted', 'archived'] as const;

export type PalinkaStatus = (typeof palinkaStatusValues)[number];

export const palinkaStatusLabels: Record<PalinkaStatus, string> = {
  active: 'Aktív',
  reserved: 'Lefoglalva',
  partial: 'Részben kiadva',
  exhausted: 'Elfogyott',
  archived: 'Archivált',
};

export const normalizePalinkaStatus = (status: unknown): PalinkaStatus =>
  palinkaStatusValues.includes(status as PalinkaStatus) ? (status as PalinkaStatus) : 'active';

export const getPalinkaStatusLabel = (status: unknown) => palinkaStatusLabels[normalizePalinkaStatus(status)];

export const palinkaAllowsNewInterest = (status: unknown) => {
  const normalized = normalizePalinkaStatus(status);
  return normalized === 'active' || normalized === 'partial';
};