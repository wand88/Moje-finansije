/* ============ Učitavanje i migracija sačuvanih podataka ============ */
import { SHARED, type AppState, type CreditState, type Member } from "../types";

export const STATE_VERSION = 3;

/* novi korisnik počinje sa jednim članom; ostale dodaje u Podacima */
export const DEFAULT_MEMBER: Member = { id: "m-ja", name: "Ja" };

type Raw = Record<string, any>;

const isObj = (x: unknown): x is Raw => !!x && typeof x === "object" && !Array.isArray(x);
const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/* Prima bilo šta (JSON iz localStorage-a ili uvezenog fajla) i vraća ispravno stanje.
   v1/v2 (muž/žena) → v3: članovi postaju lista, a postojeći ID-jevi "muz"/"zena"
   ostaju isti, pa transakcije, imovina i ciljevi ne moraju da se prepisuju. */
export function migrate(input: unknown, now: Date = new Date()): AppState {
  const s: Raw = isObj(input) && Array.isArray(input.tx) ? { ...input } : {};
  const legacy = Array.isArray(s.tx) && !Array.isArray(s.members);

  let members: Member[] = arr<Member>(s.members)
    .filter((m) => isObj(m) && typeof m.id === "string" && m.id !== SHARED)
    .map((m) => ({ id: m.id, name: String(m.name || "").trim() || "Član" }));
  if (legacy) {
    const names: Raw = isObj(s.names) ? s.names : {};
    members = [
      { id: "muz", name: String(names.muz || "Muž") },
      { id: "zena", name: String(names.zena || "Žena") },
    ];
  }
  if (!members.length) members = [{ ...DEFAULT_MEMBER }];

  let credit: CreditState | null = null;
  if (isObj(s.credit)) {
    const c: Raw = { ...s.credit };
    const incomes: Record<string, number> = isObj(c.incomes) ? { ...c.incomes } : {};
    if ("crIncM" in c) { incomes.muz = Number(c.crIncM) || 0; delete c.crIncM; }
    if ("crIncZ" in c) { incomes.zena = Number(c.crIncZ) || 0; delete c.crIncZ; }
    credit = { ...c, incomes } as CreditState;
  }

  const st: AppState = {
    version: STATE_VERSION,
    currency: typeof s.currency === "string" ? s.currency : "RSD",
    year: Number(s.year) || now.getFullYear(),
    selMonth: Number.isInteger(s.selMonth) ? s.selMonth : now.getMonth(),
    filter: typeof s.filter === "string" ? s.filter : "svi",
    members,
    tx: arr(s.tx),
    goals: arr(s.goals),
    assets: arr(s.assets),
    debts: arr(s.debts),
    customCats: arr(s.customCats),
    recurring: arr(s.recurring),
    inflation: isObj(s.inflation) ? s.inflation : {},
    budgets: isObj(s.budgets) ? s.budgets : {},
    budgetRollover: !!s.budgetRollover,
    credit,
    car: isObj(s.car) ? s.car : null,
    proj: isObj(s.proj) ? { once: Number(s.proj.once) || 0, pct: Number(s.proj.pct) || 0, extra: Number(s.proj.extra) || 0 } : { once: 0, pct: 0, extra: 0 },
  };
  st.tx.forEach((t) => { if (!t.member) t.member = SHARED; });
  /* filter koji pokazuje na obrisanog člana vraćamo na „cela porodica" */
  if (st.filter !== "svi" && st.filter !== SHARED && !members.some((m) => m.id === st.filter)) st.filter = "svi";
  return st;
}

/* da li sirovi JSON liči na rezervu ove aplikacije */
export const looksLikeBackup = (x: unknown): boolean => isObj(x) && Array.isArray(x.tx);
