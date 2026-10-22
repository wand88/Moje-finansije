/* ============ Panel preko ekrana (unos, meni „Više") — na telefonu izlazi odozdo ============ */
import { $ } from "./dom";

const returnFocus: Record<string, HTMLElement | null> = {};

export function openSheet(id: string, focusSel?: string): void {
  const bg = $<HTMLDivElement>(id);
  if (bg.classList.contains("open")) return;
  returnFocus[id] = document.activeElement as HTMLElement | null;
  bg.classList.add("open");
  document.body.style.overflow = "hidden";
  const target = (focusSel && bg.querySelector<HTMLElement>(focusSel)) || bg.querySelector<HTMLElement>("button, input, select");
  target?.focus();
}

export function closeSheet(id: string): void {
  const bg = $<HTMLDivElement>(id);
  if (!bg.classList.contains("open")) return;
  bg.classList.remove("open");
  if (!document.querySelector(".modal-bg.open")) document.body.style.overflow = "";
  returnFocus[id]?.focus?.();
}

export const isOpen = (id: string): boolean => $(id).classList.contains("open");

/* klik na pozadinu i dugmad sa data-close zatvaraju; Escape zatvara gornji otvoreni panel */
export function initSheet(id: string): void {
  const bg = $<HTMLDivElement>(id);
  bg.addEventListener("click", (e) => { if (e.target === bg) closeSheet(id); });
  bg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeSheet(id)));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen(id)) return;
    /* dijalog potvrde iznad panela ima prednost */
    if (document.querySelector(".modal.dialog")) return;
    closeSheet(id);
  });
}
