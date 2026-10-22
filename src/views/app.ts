/* ============ Iscrtavanje cele aplikacije, navigacija i filter ============ */
import { t } from "../i18n";
import { save, state } from "../store";
import { ALL, SHARED, type TxType } from "../types";
import { $, showView } from "../ui/dom";
import { closeSheet, initSheet, openSheet } from "../ui/sheet";
import { openGuide } from "./guide";
import { renderAssets, renderWarranties, setAssetDateDefault } from "./assets";
import { fillPpDebts, initCreditInputs, renderCar, renderCredit, renderPrepay, restoreCarInputs } from "./credit";
import { renderDash } from "./dash";
import { renderGoals } from "./goals";
import { fillCatSelect, fillMemberSelects, openEntry, renderMonth, updateEntryCard } from "./month";
import { renderProj } from "./proj";
import { renderSettings } from "./settings";

export function renderAll(): void {
  renderFilterBar();
  fillMemberSelects();
  fillCatSelect();
  updateEntryCard();
  renderDash();
  renderMonth();
  renderGoals();
  renderProj();
  renderAssets();
  renderWarranties();
  renderCredit();
  fillPpDebts();
  renderPrepay();
  renderCar();
  renderSettings();
}

/* polja forme koja se pune iz stanja — na startu i posle uvoza/brisanja podataka */
export function initInputs(): void {
  restoreCarInputs();
  initCreditInputs();
  setAssetDateDefault();
}

/* izmena stanja → sačuvaj i iscrtaj sve */
export function commit(): void {
  save();
  renderAll();
}

function renderFilterBar(): void {
  const bar = $<HTMLDivElement>("memberFilter");
  bar.querySelectorAll("button").forEach((b) => b.remove());
  const opts: [string, string][] = [[ALL, t("filter.all")]];
  state.members.forEach((m) => opts.push([m.id, m.name]));
  opts.push([SHARED, t("member.shared")]);
  /* jedan član bez zajedničkih stavki — filter nema smisla */
  bar.style.display = state.members.length < 2 ? "none" : "";
  opts.forEach(([id, lbl]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = lbl;
    b.classList.toggle("active", state.filter === id);
    b.setAttribute("aria-pressed", String(state.filter === id));
    b.addEventListener("click", () => { state.filter = id; commit(); });
    bar.appendChild(b);
  });
}

export function initNav(): void {
  document.querySelectorAll<HTMLButtonElement>(".tabbar .tab[data-view]").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view!)),
  );
  initSheet("moreSheet");
  $("btnMore").addEventListener("click", () => openSheet("moreSheet"));
  $("btnAdd").addEventListener("click", () => openEntry());
  /* linkovi „Sve", „Svi" i stavke menija „Više" */
  document.querySelectorAll<HTMLElement>("[data-goto]").forEach((b) => b.addEventListener("click", () => {
    closeSheet("moreSheet");
    showView(b.dataset.goto!);
  }));
  document.querySelectorAll<HTMLElement>("[data-guide]").forEach((b) => b.addEventListener("click", () => {
    closeSheet("moreSheet");
    openGuide(0);
  }));
  document.querySelectorAll<HTMLElement>("[data-add]").forEach((b) => b.addEventListener("click", () => openEntry(b.dataset.add as TxType)));
}
