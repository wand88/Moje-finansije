/* pametno spajanje dva skupa podataka (bez duplikata, po ID-ju) */
import type { AppState, Asset } from "../types";

export interface MergeStats {
  tx: number;
  goals: number;
  assets: number;
  members: number;
}

function mergeHistory<T extends Asset>(cur: T[], inc: T[], onNew: () => void): void {
  const map: Record<string, T> = {};
  cur.forEach((a) => (map[a.id] = a));
  inc.forEach((a) => {
    const have = map[a.id];
    if (!have) { cur.push(a); onNew(); return; }
    const dates = new Set(have.entries.map((e) => e.date));
    (a.entries || []).forEach((e) => { if (!dates.has(e.date)) have.entries.push(e); });
    have.entries.sort((x, y) => x.date.localeCompare(y.date));
  });
}

/* cur se menja na mestu; inc mora već biti prošao kroz migrate() */
export function mergeStates(cur: AppState, inc: AppState): MergeStats {
  const added: MergeStats = { tx: 0, goals: 0, assets: 0, members: 0 };
  const mIds = new Set(cur.members.map((m) => m.id));
  inc.members.forEach((m) => { if (!mIds.has(m.id)) { cur.members.push(m); added.members++; } });
  const txIds = new Set(cur.tx.map((t) => t.id));
  inc.tx.forEach((t) => { if (!txIds.has(t.id)) { cur.tx.push(t); added.tx++; } });
  cur.tx.sort((a, b) => a.date.localeCompare(b.date));
  const gIds = new Set(cur.goals.map((g) => g.id));
  inc.goals.forEach((g) => { if (!gIds.has(g.id)) { cur.goals.push(g); added.goals++; } });
  mergeHistory(cur.assets, inc.assets, () => added.assets++);
  mergeHistory(cur.debts, inc.debts, () => {});
  Object.entries(inc.budgets).forEach(([k, v]) => { if (!cur.budgets[k]) cur.budgets[k] = v; });
  const cIds = new Set(cur.customCats.map((c) => c.id));
  inc.customCats.forEach((c) => { if (!cIds.has(c.id)) cur.customCats.push(c); });
  const rIds = new Set(cur.recurring.map((r) => r.id));
  inc.recurring.forEach((r) => { if (!rIds.has(r.id)) cur.recurring.push(r); });
  return added;
}
