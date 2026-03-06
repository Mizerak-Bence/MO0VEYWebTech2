export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export type Palinka = {
  id: string;
  name: string;
  fruitType: string;
  abvPercent: number;
  volumeLiters: number;
  distillationStyle: string;
  madeDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type CreatePalinkaRequest = {
  name: string;
  fruitType: string;
  abvPercent: number;
  volumeLiters: number;
  distillationStyle: string;
  madeDate?: string;
  notes?: string;
};
