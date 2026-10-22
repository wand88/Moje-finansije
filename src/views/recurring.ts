/* ============ Ponavljajuće transakcije ============ */
import { fmtDate, recAdvance, recNext, todayISO } from "../lib/dates";
import { catById, catsOf, fmt, memberBadge } from "../model";
import { device, state, uid } from "../store";
import type { Recurring, TxType } from "../types";
import { confirmDialog } from "../ui/dialog";
import { icon } from "../ui/icons";
import { $, escapeHtml, onData } from "../ui/dom";
import { commit } from "./app";

function fillRecCat(): void {
  const sel = $<HTMLSelectElement>("recCat");
  const cur = sel.value;
  sel.innerHTML = catsOf($("recType").value).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

/* proknjiži sve dospele pojave (maks. 24 unazad) i pomeri sledeći datum */
export function recPost(r: Recurring, today = todayISO()): number {
  let posted = 0;
  while (r.next <= today && posted < 24) {
    state.tx.push({
      id: "rec-" + uid(), date: r.next, type: r.type, category: r.category,
      member: r.member, enteredBy: device || undefined,
      note: r.name, amount: r.amount, src: "rec",
    });
    r.next = recAdvance(r.next, r.day);
    posted++;
  }
  return posted;
}

const sortTx = () => state.tx.sort((a, b) => a.date.localeCompare(b.date));

export function initRecurring(): void {
  $("recType").addEventListener("change", fillRecCat);
  $<HTMLFormElement>("recForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = parseFloat($("recAmount").value);
    const day = Math.min(28, Math.max(1, Math.round(parseFloat($("recDay").value) || 1)));
    if (!(amount > 0)) return;
    state.recurring.push({
      id: uid(),
      name: $("recName").value.trim(),
      type: $("recType").value as TxType,
      category: $("recCat").value,
      member: $("recMember").value,
      amount, day,
      next: recNext(day),
      active: true,
    });
    $<HTMLFormElement>("recForm").reset();
    $("recDay").value = "1";
    commit();
  });
}

export function renderRecurring(): void {
  fillRecCat();
  const today = todayISO();
  const due = state.recurring.filter((r) => r.active && r.next <= today);
  const dueBox = $<HTMLDivElement>("recDue");
  dueBox.innerHTML = due.length
    ? `<div class="callout warn" style="margin:0 0 14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap">
        <span style="flex:1">Dospelo za knjiženje: <b>${due.length}</b> (${due.map((r) => escapeHtml(r.name)).join(", ")})</span>
        <button class="btn sm" type="button" id="btnRecPostAll">Proknjiži sve</button>
       </div>`
    : "";
  if (due.length) $("btnRecPostAll").addEventListener("click", () => {
    due.forEach((r) => recPost(r));
    sortTx();
    commit();
  });
  const box = $<HTMLDivElement>("recTable");
  if (state.recurring.length === 0) { box.innerHTML = ""; return; }
  let html = `<table><thead><tr><th>Naziv</th><th>Kategorija</th><th>Čije</th><th class="num">Iznos</th><th>Sledeće</th><th><span class="sr-only">Akcije</span></th></tr></thead><tbody>`;
  state.recurring.forEach((r) => {
    const c = catById(r.category);
    const isDue = r.active && r.next <= today;
    const id = escapeHtml(r.id);
    html += `<tr style="${r.active ? "" : "opacity:.5"}">
      <td><b>${escapeHtml(r.name)}</b>${r.type === "prihod" ? ` <span class="note">(prihod)</span>` : ""}</td>
      <td><span class="cat-dot" style="background:${escapeHtml(c.color)}"></span>${escapeHtml(c.name)}</td>
      <td>${memberBadge(r.member)}</td>
      <td class="num" style="font-weight:600">${fmt(r.amount)}</td>
      <td>${isDue ? `<span class="pill warn">dospelo ${fmtDate(r.next, false)}</span>` : fmtDate(r.next)}</td>
      <td style="white-space:nowrap">
        ${isDue ? `<button class="btn sm" type="button" data-recpost="${id}">Proknjiži</button> ` : ""}
        <button class="btn ghost sm" type="button" data-recpause="${id}">${r.active ? "Pauziraj" : "Aktiviraj"}</button>
        <button class="del" type="button" title="Obriši" aria-label="Obriši ponavljajuću transakciju" data-recdel="${id}">${icon("trash", 16)}</button>
      </td>
    </tr>`;
  });
  box.innerHTML = html + `</tbody></table>`;
  const find = (id: string) => state.recurring.find((x) => x.id === id);
  onData(box, "recpost", (id) => {
    const r = find(id);
    if (!r) return;
    recPost(r);
    sortTx();
    commit();
  });
  onData(box, "recpause", (id) => {
    const r = find(id);
    if (!r) return;
    r.active = !r.active;
    if (r.active) r.next = recNext(r.day);
    commit();
  });
  onData(box, "recdel", async (id) => {
    if (!(await confirmDialog("Obrisati ovu ponavljajuću transakciju? (Već proknjiženi unosi ostaju.)", { danger: true, okText: "Obriši" }))) return;
    state.recurring = state.recurring.filter((x) => x.id !== id);
    commit();
  });
}
