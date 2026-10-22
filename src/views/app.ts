/* ============ Iscrtavanje cele aplikacije, navigacija i filter ============ */
import { t } from "../i18n";
import { save, state } from "../store";
import { ALL, SHARED } from "../types";
import { $, showView } from "../ui/dom";
import { renderAssets, renderWarranties, setAssetDateDefault } from "./assets";
import { fillPpDebts, initCreditInputs, renderCar, renderCredit, renderPrepay, restoreCarInputs } from "./credit";
import { renderDash } from "./dash";
import { renderGoals } from "./goals";
import { fillCatSelect, fillMemberSelects, renderMonth, updateEntryCard } from "./month";
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
  state.members.forEach((m) => opts.push([m.id, "👤 " + m.name]));
  opts.push([SHARED, "🤝 " + t("member.shared")]);
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
  document.querySelectorAll<HTMLButtonElement>("nav button").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view || "dash")),
  );
}
