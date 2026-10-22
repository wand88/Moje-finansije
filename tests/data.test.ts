import { describe, expect, it } from "vitest";
import { mergeStates } from "../src/lib/merge";
import { DEFAULT_MEMBER, STATE_VERSION, looksLikeBackup, migrate } from "../src/lib/migrate";

/* izgled podataka iz stare verzije (jedan index.html, muž/žena) */
const legacy = {
  currency: "RSD", year: 2026, selMonth: 9, filter: "zena",
  names: { muz: "Pera", zena: "Mika" },
  tx: [
    { id: "1", date: "2026-10-01", type: "prihod", category: "plata", member: "muz", note: "", amount: 100000 },
    { id: "2", date: "2026-10-02", type: "rashod", category: "potrosnja", note: "Maxi", amount: 3000 },
  ],
  goals: [], assets: [], debts: [], customCats: [], recurring: [],
  credit: { crIncM: 100000, crIncZ: 80000, crDti: 36, loanType: "stambeni" },
};

describe("migrate", () => {
  it("stari muž/žena podaci postaju lista članova sa istim ID-jevima", () => {
    const s = migrate(legacy);
    expect(s.version).toBe(STATE_VERSION);
    expect(s.members).toEqual([{ id: "muz", name: "Pera" }, { id: "zena", name: "Mika" }]);
    expect(s.filter).toBe("zena");
    expect(s.tx[0].member).toBe("muz");
    expect(s.tx[1].member).toBe("zajedno");
    expect(s.credit).toEqual({ incomes: { muz: 100000, zena: 80000 }, crDti: 36, loanType: "stambeni" });
  });
  it("ne menja ulazni objekat i radi idempotentno", () => {
    const copy = JSON.parse(JSON.stringify(legacy));
    const once = migrate(copy);
    expect(copy.credit.crIncM).toBe(100000);
    expect(migrate(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
  it("novi korisnik dobija jednog člana i prazne liste", () => {
    const s = migrate(null, new Date(2026, 9, 22));
    expect(s.members).toEqual([DEFAULT_MEMBER]);
    expect(s.year).toBe(2026);
    expect(s.selMonth).toBe(9);
    expect(s.tx).toEqual([]);
    expect(s.proj).toEqual({ once: 0, pct: 0, extra: 0 });
  });
  it("filter na nepostojećeg člana se vraća na celo domaćinstvo", () => {
    expect(migrate({ tx: [], members: [{ id: "a", name: "A" }], filter: "b" }).filter).toBe("svi");
  });
  it("prepoznaje rezervu samo ako ima listu transakcija", () => {
    expect(looksLikeBackup(legacy)).toBe(true);
    expect(looksLikeBackup({ foo: 1 })).toBe(false);
    expect(looksLikeBackup(null)).toBe(false);
  });
});

describe("mergeStates", () => {
  it("spaja bez duplikata i dopunjuje istoriju imovine", () => {
    const cur = migrate({
      tx: [{ id: "1", date: "2026-10-01", type: "rashod", category: "dom", member: "m-ja", note: "", amount: 1 }],
      members: [{ id: "m-ja", name: "Ana" }],
      assets: [{ id: "a1", name: "Zlato", type: "Investiciono zlato", member: "m-ja", entries: [{ date: "2026-01-01", value: 100 }] }],
    });
    const inc = migrate({
      tx: [
        { id: "1", date: "2026-10-01", type: "rashod", category: "dom", member: "m-ja", note: "", amount: 1 },
        { id: "2", date: "2026-09-01", type: "prihod", category: "plata", member: "m-x", note: "", amount: 5 },
      ],
      members: [{ id: "m-ja", name: "Ana" }, { id: "m-x", name: "Marko" }],
      assets: [{ id: "a1", name: "Zlato", type: "Investiciono zlato", member: "m-ja", entries: [{ date: "2026-06-01", value: 120 }] }],
    });
    const added = mergeStates(cur, inc);
    expect(added).toEqual({ tx: 1, goals: 0, assets: 0, members: 1 });
    expect(cur.tx.map((t) => t.id)).toEqual(["2", "1"]); /* sortirano po datumu */
    expect(cur.members.map((m) => m.name)).toEqual(["Ana", "Marko"]);
    expect(cur.assets[0].entries.map((e) => e.value)).toEqual([100, 120]);
    /* ponovno spajanje istog fajla ne dodaje ništa */
    expect(mergeStates(cur, inc)).toEqual({ tx: 0, goals: 0, assets: 0, members: 0 });
  });
});
