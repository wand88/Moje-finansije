/* ============ Model podataka ============ */
export type TxType = "prihod" | "rashod";

/* pseudo-član za zajedničke stavke domaćinstva */
export const SHARED = "zajedno";
/* filter „cela porodica" */
export const ALL = "svi";

export interface Member {
  id: string;
  name: string;
}

export interface Tx {
  id: string;
  date: string; // YYYY-MM-DD, lokalni datum
  type: TxType;
  category: string;
  member: string;
  enteredBy?: string;
  link?: string;
  warranty?: string;
  note: string;
  goalId?: string;
  amount: number;
  src?: "rec" | "csv";
}

export interface Goal {
  id: string;
  name: string;
  member: string;
  target: number;
  start: number;
  deadline: string; // YYYY-MM
}

export interface ValueEntry {
  date: string;
  value: number;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  member: string;
  entries: ValueEntry[];
}

export interface Debt extends Asset {
  rate: number;
}

export interface Recurring {
  id: string;
  name: string;
  type: TxType;
  category: string;
  member: string;
  amount: number;
  day: number;
  next: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  type?: TxType;
}

export interface CreditState {
  loanType?: string;
  /* neto mesečni prihod po članu (id člana → iznos) */
  incomes: Record<string, number>;
  crOblig?: number;
  crDti?: number;
  crApr?: number;
  crYears?: number;
  crDown?: number;
}

export interface ProjState {
  once: number;
  pct: number;
  extra: number;
}

export interface AppState {
  version: number;
  currency: string;
  year: number;
  selMonth: number;
  filter: string;
  members: Member[];
  tx: Tx[];
  goals: Goal[];
  assets: Asset[];
  debts: Debt[];
  customCats: Category[];
  recurring: Recurring[];
  inflation: Record<string, number>;
  budgets: Record<string, number>;
  budgetRollover?: boolean;
  credit: CreditState | null;
  car: Record<string, number> | null;
  proj: ProjState;
}
