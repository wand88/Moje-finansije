/* ============ DOM pomoćnici ============ */

/* element po ID-ju; podrazumevano polje forme (input/select imaju .value) */
export function $<T extends HTMLElement = HTMLInputElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Nema elementa #${id}`);
  return el as T;
}

export const num = (id: string): number => parseFloat($(id).value) || 0;

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/* event delegacija za dugmad sa data-* atributom unutar kontejnera */
export function onData(box: ParentNode, attr: string, fn: (value: string, el: HTMLElement) => void, event = "click"): void {
  box.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((el) =>
    el.addEventListener(event, () => fn(el.getAttribute(`data-${attr}`) || "", el)),
  );
}

/* prebacivanje na tab */
export function showView(view: string): void {
  document.querySelectorAll<HTMLElement>("nav button").forEach((x) => x.classList.toggle("active", x.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
}
