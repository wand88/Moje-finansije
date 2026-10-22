/* ============ Podaci: podešavanja, članovi, kategorije, rezervna kopija ============ */
import { t } from "../i18n";
import { todayISO } from "../lib/dates";
import { mergeStates } from "../lib/merge";
import { looksLikeBackup, migrate } from "../lib/migrate";
import { BASE_EXP_CATS, BASE_INC_CATS, expCats, incCats } from "../model";
import { device, save, setDevice, setState, state, uid, wipe } from "../store";
import { SHARED, type TxType } from "../types";
import { alertDialog, confirmDialog, promptDialog, toast } from "../ui/dialog";
import { $, escapeHtml, onData } from "../ui/dom";
import { commit, initInputs, renderAll } from "./app";

/* ---- članovi domaćinstva ---- */
const nameTaken = (name: string, exceptId?: string) =>
  state.members.some((m) => m.id !== exceptId && m.name.toLowerCase() === name.toLowerCase());

function refsOf(id: string): number {
  return [state.tx, state.goals, state.assets, state.debts, state.recurring].reduce((n, arr) => n + arr.filter((x) => x.member === id).length, 0);
}

function renderMembers(): void {
  const box = $<HTMLDivElement>("memberList");
  box.innerHTML = state.members.map((m) => `
    <div class="member-row">
      <span class="member-badge">👤 ${escapeHtml(m.name)}</span>
      ${m.id === device ? `<span class="note">(ovaj uređaj)</span>` : ""}
      <span class="spacer"></span>
      <button class="btn ghost sm" type="button" data-mrename="${escapeHtml(m.id)}">${t("members.rename")}</button>
      <button class="btn ghost sm" type="button" data-mremove="${escapeHtml(m.id)}" ${state.members.length < 2 ? "disabled" : ""}>${t("members.remove")}</button>
    </div>`).join("");
  onData(box, "mrename", async (id) => {
    const m = state.members.find((x) => x.id === id);
    if (!m) return;
    const name = (await promptDialog(t("members.renamePrompt", { name: m.name }), m.name))?.trim();
    if (!name || name === m.name) return;
    if (nameTaken(name, id)) { toast(t("members.exists"), "warn"); return; }
    m.name = name.slice(0, 20);
    commit();
  });
  onData(box, "mremove", async (id) => {
    const m = state.members.find((x) => x.id === id);
    if (!m) return;
    if (state.members.length < 2) { toast(t("members.removeLast"), "warn"); return; }
    if (!(await confirmDialog(t("members.removeConfirm", { name: m.name, count: refsOf(id) }), { danger: true, okText: t("members.remove") }))) return;
    /* stavke uklonjenog člana postaju zajedničke — ništa se ne briše */
    [state.tx, state.goals, state.assets, state.debts, state.recurring].forEach((arr) =>
      arr.forEach((x) => { if (x.member === id) x.member = SHARED; }));
    state.members = state.members.filter((x) => x.id !== id);
    if (state.credit) delete state.credit.incomes[id];
    if (state.filter === id) state.filter = "svi";
    if (device === id) setDevice("");
    commit();
  });
}

/* ---- kategorije po želji ---- */
function renderCatList(): void {
  const box = $<HTMLDivElement>("catList");
  const chip = (c: { color: string; name: string }) =>
    `<span class="cat-dot" style="background:${escapeHtml(c.color)}"></span>${escapeHtml(c.name)}`;
  let html = BASE_EXP_CATS.concat(BASE_INC_CATS).map((c) => `<span class="chip" style="cursor:default">${chip(c)}</span>`).join("");
  html += state.customCats.map((c) =>
    `<span class="chip" style="cursor:default">${chip(c)}
     <span class="note">(${c.type === "prihod" ? "prihod" : "rashod"})</span>
     <button class="del" type="button" style="font-size:12px;padding:0 2px" title="Obriši kategoriju" aria-label="Obriši kategoriju ${escapeHtml(c.name)}" data-catdel="${escapeHtml(c.id)}">✕</button></span>`).join("");
  box.innerHTML = html;
  onData(box, "catdel", async (id) => {
    if (state.tx.some((x) => x.category === id)) {
      await alertDialog("Ova kategorija ima transakcije — ne može da se obriše dok one postoje.");
      return;
    }
    state.customCats = state.customCats.filter((c) => c.id !== id);
    delete state.budgets[id];
    commit();
  });
}

export function renderSettings(): void {
  renderMembers();
  renderCatList();
  $("setCurrency").value = state.currency;
  const devSel = $<HTMLSelectElement>("setDevice");
  devSel.innerHTML = `<option value="">${escapeHtml(t("members.deviceNone"))}</option>` +
    state.members.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join("");
  devSel.value = state.members.some((m) => m.id === device) ? device : "";
  const ySel = $<HTMLSelectElement>("setYear");
  const thisY = new Date().getFullYear();
  const years = new Set([thisY - 1, thisY, thisY + 1, state.year]);
  state.tx.forEach((x) => years.add(parseInt(x.date.slice(0, 4), 10)));
  ySel.innerHTML = [...years].sort().map((y) => `<option value="${y}">${y}.</option>`).join("");
  ySel.value = String(state.year);
  $("dataStats").textContent =
    `Sačuvano: ${state.tx.length} transakcija, ${state.goals.length} ciljeva, ${state.assets.length} stavki imovine, ${state.debts.length} obaveza.`;
}

/* ---- rezervna kopija ---- */
function readJsonFile(input: HTMLInputElement, fn: (data: unknown) => void): void {
  const f = input.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data: unknown = null;
    try { data = JSON.parse(String(reader.result)); } catch { /* nije JSON */ }
    input.value = "";
    if (!looksLikeBackup(data)) { alertDialog("Fajl nije prepoznat kao rezerva ove aplikacije."); return; }
    fn(data);
  };
  reader.readAsText(f);
}

export function initSettings(): void {
  $("setCurrency").addEventListener("change", () => { state.currency = $("setCurrency").value; commit(); });
  $("setYear").addEventListener("change", () => { state.year = parseInt($("setYear").value, 10); commit(); });
  $("setDevice").addEventListener("change", () => {
    setDevice($("setDevice").value);
    renderAll();
  });

  $<HTMLFormElement>("memberForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("memberName").value.trim().slice(0, 20);
    if (!name) return;
    if (nameTaken(name)) { toast(t("members.exists"), "warn"); return; }
    state.members.push({ id: "m-" + uid(), name });
    $<HTMLFormElement>("memberForm").reset();
    commit();
  });

  $<HTMLFormElement>("catForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("catName").value.trim();
    const type = $("catType").value as TxType;
    if (!name) return;
    if (BASE_EXP_CATS.concat(BASE_INC_CATS, state.customCats).some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      await alertDialog("Kategorija sa tim nazivom već postoji.");
      return;
    }
    const slot = ((type === "rashod" ? expCats().length : incCats().length) % 8) + 1;
    state.customCats.push({ id: "c-" + uid(), name, type, color: `var(--s${slot})` });
    $<HTMLFormElement>("catForm").reset();
    commit();
  });

  $("btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `moje-finansije-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("btnImport").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => readJsonFile(e.target as HTMLInputElement, async (data) => {
    if (!(await confirmDialog("Uvoz ZAMENJUJE sve trenutne podatke na ovom uređaju podacima iz fajla. Nastaviti?", { danger: true, okText: "Zameni sve" }))) return;
    setState(migrate(data));
    save();
    initInputs();
    renderAll();
    toast("Podaci su uspešno uvezeni. ✅", "good");
  }));

  $("btnMerge").addEventListener("click", () => $("mergeFile").click());
  $("mergeFile").addEventListener("change", (e) => readJsonFile(e.target as HTMLInputElement, (data) => {
    const added = mergeStates(state, migrate(data));
    commit();
    alertDialog(`Dodato: ${added.tx} transakcija, ${added.goals} ciljeva, ${added.assets} stavki imovine${added.members ? `, ${added.members} članova` : ""}.`, "Spojeno bez duplikata ✅");
  }));

  $("btnWipe").addEventListener("click", async () => {
    if (!(await confirmDialog("Obrisati SVE podatke (transakcije, ciljeve, imovinu, podešavanja)? Ovo se ne može poništiti.", { danger: true, okText: "Obriši sve" }))) return;
    wipe();
    initInputs();
    renderAll();
  });
}
