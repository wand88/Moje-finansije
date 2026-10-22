/* ============ SVG grafikoni + tooltip ============ */
import { expCats, fmt, fmtN } from "../model";
import { $, escapeHtml } from "./dom";

/* ---- tooltip ---- */
const tip = () => $<HTMLDivElement>("tooltip");
function showTip(html: string, evt: MouseEvent): void {
  const el = tip();
  el.innerHTML = html;
  el.style.display = "block";
  const pad = 14;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  const r = el.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
  el.style.left = x + window.scrollX + "px";
  el.style.top = y + window.scrollY + "px";
}
export function hideTip(): void {
  tip().style.display = "none";
}
export function attachTip(node: Element, htmlFn: () => string): void {
  node.addEventListener("mousemove", (e) => showTip(htmlFn(), e as MouseEvent));
  node.addEventListener("mouseleave", hideTip);
}

/* ---- SVG pomoćnici ---- */
const NS = "http://www.w3.org/2000/svg";
export function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}
export function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
export function roundTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "M0 0";
  r = Math.min(r, w / 2, h);
  return `M${x} ${y + h} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h} Z`;
}
function roundRight(x: number, y: number, w: number, h: number, r: number): string {
  if (w <= 0) return "M0 0";
  r = Math.min(r, h / 2, w);
  return `M${x} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x} ${y + h} Z`;
}

export interface Series {
  name: string;
  color: string;
  vals: (number | null)[];
  dash?: boolean;
  noDots?: boolean;
}
const ok = (v: number | null): v is number => v != null && isFinite(v);

/* opšti linijski grafikon: labels = x oznake */
export function renderLines(containerId: string, labels: string[], series: Series[], tipExtra?: (i: number) => string): void {
  const wrap = $<HTMLDivElement>(containerId);
  wrap.innerHTML = "";
  const n = labels.length;
  const W = 940, H = 280, mL = 76, mR = 16, mT = 14, mB = 30;
  const pw = W - mL - mR, ph = H - mT - mB;
  const all = series.flatMap((s) => s.vals).filter(ok);
  if (!all.length) all.push(0);
  const lo = Math.min(0, ...all), hi = Math.max(...all, 1);
  const maxV = niceMax(hi), minV = lo < 0 ? -niceMax(-lo) : 0;
  const yOf = (v: number) => mT + ph - (ph * (v - minV)) / (maxV - minV);
  const xOf = (i: number) => mL + (pw * i) / Math.max(1, n - 1);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
  for (let i = 0; i <= 4; i++) {
    const v = minV + ((maxV - minV) * i) / 4, y = yOf(v);
    svg.appendChild(el("line", { x1: mL, x2: W - mR, y1: y, y2: y, stroke: Math.abs(v) < 1e-9 ? "var(--baseline)" : "var(--grid)", "stroke-width": 1 }));
    const t = el("text", { x: mL - 8, y: y + 4, "text-anchor": "end", fill: "var(--muted)", "font-size": 11 });
    t.textContent = fmtN(v);
    svg.appendChild(t);
  }
  const step = Math.ceil(n / 14);
  labels.forEach((lb, i) => {
    if (i % step) return;
    const t = el("text", { x: xOf(i), y: H - 10, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 });
    t.textContent = lb;
    svg.appendChild(t);
  });
  series.forEach((s) => {
    let d = "", pen = false;
    s.vals.forEach((v, i) => {
      if (!ok(v)) { pen = false; return; }
      d += (pen ? "L" : "M") + xOf(i) + " " + yOf(v);
      pen = true;
    });
    const p = el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" });
    if (s.dash) p.setAttribute("stroke-dasharray", "6 5");
    svg.appendChild(p);
  });
  for (let i = 0; i < n; i++) {
    series.forEach((s) => {
      const v = s.vals[i];
      if (!ok(v) || s.noDots) return;
      svg.appendChild(el("circle", { cx: xOf(i), cy: yOf(v), r: 3.5, fill: s.color, stroke: "var(--surface-1)", "stroke-width": 2 }));
    });
    const slot = pw / Math.max(1, n - 1);
    const hit = el("rect", { x: xOf(i) - slot / 2, y: mT, width: slot, height: ph, fill: "transparent" });
    attachTip(hit, () =>
      `<div class="t-title">${escapeHtml(labels[i])}</div>` +
      series.map((s) => {
        const v = s.vals[i];
        return ok(v) ? `<div class="t-row"><span><i style="background:${escapeHtml(s.color)}"></i>${escapeHtml(s.name)}</span><b>${fmt(v)}</b></div>` : "";
      }).join("") +
      (tipExtra ? tipExtra(i) : ""));
    svg.appendChild(hit);
  }
  wrap.appendChild(svg);
}

export interface Slice {
  name: string;
  color: string;
  v: number;
}

/* donut grafikon sa legendom */
export function renderDonut(containerId: string, rows: Slice[], centerLabel: string): void {
  const wrap = $<HTMLDivElement>(containerId);
  wrap.innerHTML = "";
  const total = rows.reduce((s, r) => s + r.v, 0);
  if (total <= 0) { wrap.innerHTML = `<div class="empty">Još nema rashoda za prikaz.</div>`; return; }
  /* male kriške (<3%) grupišemo u „Ostalo" da grafikon ostane čitljiv */
  const big: Slice[] = [], small: Slice[] = [];
  rows.filter((r) => r.v > 0).sort((a, b) => b.v - a.v).forEach((r) => (r.v / total >= 0.03 ? big : small).push(r));
  const slices = big.slice();
  if (small.length) slices.push({ name: small.length === 1 ? small[0].name : "Ostalo (" + small.length + ")", color: "var(--muted)", v: small.reduce((s, r) => s + r.v, 0) });
  const size = 210, cx = size / 2, cy = size / 2, R = 78, SW = 30, GAP = 0.035;
  const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: "img", "aria-label": centerLabel });
  let a = -Math.PI / 2;
  slices.forEach((s) => {
    const frac = s.v / total;
    const a0 = a + GAP / 2, a1 = a + frac * 2 * Math.PI - GAP / 2;
    a += frac * 2 * Math.PI;
    if (a1 <= a0) return;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = el("path", {
      d: `M${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)}`,
      fill: "none", stroke: s.color, "stroke-width": SW,
    });
    p.style.cursor = "default";
    p.addEventListener("mouseenter", () => p.setAttribute("stroke-width", String(SW + 6)));
    p.addEventListener("mouseleave", () => p.setAttribute("stroke-width", String(SW)));
    attachTip(p, () => `<div class="t-title">${escapeHtml(s.name)}</div>
      <div class="t-row"><span>Iznos</span><b>${fmt(s.v)}</b></div>
      <div class="t-row"><span>Udeo</span><b>${((100 * s.v) / total).toFixed(1)}%</b></div>`);
    svg.appendChild(p);
  });
  const t1 = el("text", { x: cx, y: cy - 4, "text-anchor": "middle", fill: "var(--ink)", "font-size": 17, "font-weight": 700 });
  t1.textContent = fmtN(total);
  const t2 = el("text", { x: cx, y: cy + 15, "text-anchor": "middle", fill: "var(--muted)", "font-size": 11 });
  t2.textContent = centerLabel;
  svg.appendChild(t1);
  svg.appendChild(t2);
  const legend = document.createElement("div");
  legend.className = "donut-legend";
  legend.innerHTML = slices.map((s) => `
    <div class="dl-row">
      <span class="cat-dot" style="background:${escapeHtml(s.color)}"></span>
      <span class="dl-name">${escapeHtml(s.name)}</span>
      <span class="dl-val">${fmt(s.v)}</span>
      <span class="dl-pct">${((100 * s.v) / total).toFixed(0)}%</span>
    </div>`).join("");
  const flex = document.createElement("div");
  flex.className = "donut-wrap";
  flex.appendChild(svg);
  flex.appendChild(legend);
  wrap.appendChild(flex);
}

/* horizontalni stubići rashoda po kategorijama */
export function renderCatBars(containerId: string, totals: Record<string, number>): void {
  const wrap = $<HTMLDivElement>(containerId);
  wrap.innerHTML = "";
  const rows = expCats().map((c) => ({ ...c, v: totals[c.id] || 0 }));
  const maxV = niceMax(Math.max(...rows.map((r) => r.v), 1));
  const W = 940, rowH = 34, mL = 150, mR = 120, H = rows.length * rowH + 10;
  const pw = W - mL - mR;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
  svg.appendChild(el("line", { x1: mL, x2: mL, y1: 4, y2: H - 4, stroke: "var(--baseline)", "stroke-width": 1 }));
  rows.forEach((r, i) => {
    const y = 5 + rowH * i + (rowH - 16) / 2;
    const w = Math.max(r.v > 0 ? 2 : 0, (pw * r.v) / maxV);
    const lbl = el("text", { x: mL - 10, y: y + 12, "text-anchor": "end", fill: "var(--ink-2)", "font-size": 12.5, "font-weight": 600 });
    lbl.textContent = r.name;
    svg.appendChild(lbl);
    const bar = el("path", { d: roundRight(mL, y, w, 16, 4), fill: r.color });
    attachTip(bar, () => `<div class="t-title">${escapeHtml(r.name)}</div><div class="t-row"><span>Ukupno</span><b>${fmt(r.v)}</b></div>`);
    svg.appendChild(bar);
    const val = el("text", { x: mL + w + 8, y: y + 12, fill: "var(--ink)", "font-size": 12, "font-weight": 600 });
    val.textContent = fmt(r.v);
    svg.appendChild(val);
  });
  wrap.appendChild(svg);
}

/* totali rashoda po kategoriji */
export function expTotals(tx: { type: string; category: string; amount: number }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  tx.forEach((t) => { if (t.type === "rashod") totals[t.category] = (totals[t.category] || 0) + t.amount; });
  return totals;
}
