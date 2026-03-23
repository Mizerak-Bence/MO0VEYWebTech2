type BuildPalinkaNameInput = {
  name?: string;
  fruitType: string;
  distillationStyle: string;
  volumeLiters: number;
  containerCapacityLiters?: number;
  abvPercent?: number | null;
  madeDate?: string | Date | null;
};

const formatNumber = (value: number) => {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return normalized.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const normalizePart = (value: string) => value.trim().replace(/\s+/g, ' ');

export const buildPalinkaName = (input: BuildPalinkaNameInput) => {
  const explicitName = input.name?.trim();
  if (explicitName) {
    return explicitName.slice(0, 100);
  }

  const parts = [
    normalizePart(input.fruitType),
    normalizePart(input.distillationStyle),
    `${formatNumber(input.volumeLiters)}L`,
  ];

  if (input.containerCapacityLiters != null) {
    parts.push(`tarolo-${formatNumber(input.containerCapacityLiters)}L`);
  }

  if (input.abvPercent != null) {
    parts.push(`${formatNumber(input.abvPercent)}%`);
  }

  if (input.madeDate) {
    const madeDate = input.madeDate instanceof Date ? input.madeDate : new Date(input.madeDate);
    if (!Number.isNaN(madeDate.getTime())) {
      parts.push(madeDate.toISOString().slice(0, 10));
    }
  }

  return parts.join(' | ').slice(0, 100);
};