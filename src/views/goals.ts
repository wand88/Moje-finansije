/* ============ Ciljevi ============ */
import { isoLocal, monthsLeft } from "../lib/dates";
import { MONTHS, fmt, memberBadge, sum } from "../model";
import { state, uid } from "../store";
import type { Goal } from "../types";
import { confirmDialog } from "../ui/dialog";
import { icon } from "../ui/icons";
import { $, escapeHtml, onData } from "../ui/dom";
import { commit } from "./app";

export function goalSaved(g: Goal): number {
  return (g.start || 0) + sum(state.tx.filter((t) => t.goalId === g.id), (t) => t.amount);
}

/* prosečna mesečna uplata u poslednjih 90 dana */
export function goalMonthlyAvg(g: Goal): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cs = isoLocal(cutoff);
  return sum(state.tx.filter((t) => t.goalId === g.id && t.date >= cs), (t) => t.amount) / 3;
}

/* koliko mesečno treba do roka (ako je rok prošao — ceo ostatak odmah) */
export function goalNeeded(g: Goal): number {
  const left = monthsLeft(g.deadline);
  const rest = g.target - goalSaved(g);
  return left > 0 ? Math.max(0, rest) / left : rest;
}

const GOAL_IDEAS = [
  "Učešće za stan", "Kupovina auta", "Letovanje", "Zimovanje",
  "Hitna rezerva (3–6 meseci)", "Renoviranje", "Nameštaj", "Svadba",
  "Beba", "Školovanje dece", "Investiciono zlato", "Sat",
  "Tehnika / laptop", "Pokretanje biznisa", "Penzija / dugoročno", "Zdravlje / stomatolog",
];

export function initGoals(): void {
  const box = $<HTMLDivElement>("goalChips");
  box.innerHTML = GOAL_IDEAS.map((g, i) => `<button type="button" class="chip" data-idea="${i}">${g}</button>`).join("");
  onData(box, "idea", (i) => {
    $("gName").value = GOAL_IDEAS[Number(i)];
    $("gTarget").focus();
  });
  $<HTMLFormElement>("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const target = parseFloat($("gTarget").value);
    const deadline = $("gDeadline").value;
    if (!(target > 0) || !deadline) return;
    state.goals.push({
      id: uid(),
      name: $("gName").value.trim(),
      member: $("gMember").value,
      target,
      start: parseFloat($("gStart").value) || 0,
      deadline,
    });
    $<HTMLFormElement>("goalForm").reset();
    $("gStart").value = "0";
    commit();
  });
}

export function renderGoals(): void {
  const grid = $<HTMLDivElement>("goalGrid");
  grid.innerHTML = "";
  $<HTMLDivElement>("goalsEmpty").style.display = state.goals.length ? "none" : "block";
  state.goals.forEach((g) => {
    const saved = goalSaved(g);
    const pct = Math.min(100, (100 * saved) / g.target);
    const left = monthsLeft(g.deadline);
    const done = saved >= g.target;
    const needed = goalNeeded(g);
    const avg = goalMonthlyAvg(g);
    let status: string;
    if (done) status = `<div class="g-status ok">Cilj ostvaren</div>`;
    else if (left <= 0) status = `<div class="g-status behind">Rok je prošao — nedostaje ${fmt(g.target - saved)}</div>`;
    else if (avg >= needed && avg > 0) status = `<div class="g-status ok">Na putu si — prosek uplata ${fmt(avg)}/mes ≥ potrebno ${fmt(needed)}/mes</div>`;
    else status = `<div class="g-status ${avg > 0 ? "behind" : "neutral"}">Potrebno ${fmt(needed)}/mes narednih ${left} mes.${avg > 0 ? ` (tvoj prosek: ${fmt(avg)}/mes)` : ""}</div>`;
    const [dy, dm] = g.deadline.split("-").map(Number);
    const card = document.createElement("div");
    card.className = "goal";
    card.innerHTML = `
      <div class="g-head"><h3>${escapeHtml(g.name)}</h3>${memberBadge(g.member)}</div>
      <div class="g-target">Cilj: <b>${fmt(g.target)}</b> do ${MONTHS[dm - 1].toLowerCase()} ${dy}.</div>
      <div class="pbar ${done ? "done" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Napredak: ${escapeHtml(g.name)}"><div style="width:${pct}%"></div></div>
      <div class="g-stats"><span>Ušteđeno: <b>${fmt(saved)}</b></span><span>${Math.round(pct)}%</span></div>
      ${status}
      <div class="g-foot">
        <span class="note">Uplate: Mesečno → Štednja → izaberi cilj</span>
        <button class="del" type="button" title="Obriši cilj" aria-label="Obriši cilj ${escapeHtml(g.name)}" data-goal="${escapeHtml(g.id)}">${icon("trash", 16)}</button>
      </div>`;
    grid.appendChild(card);
  });
  onData(grid, "goal", async (id) => {
    if (!(await confirmDialog("Obrisati ovaj cilj? Transakcije ostaju sačuvane.", { danger: true, okText: "Obriši" }))) return;
    state.goals = state.goals.filter((g) => g.id !== id);
    state.tx.forEach((t) => { if (t.goalId === id) delete t.goalId; });
    commit();
  });
}
