/* ============ Ikonice (stroke SVG, 24×24) — umesto emoji-ja ============ */

const P = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.5v1",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  gem: "M6 3h12l3 6-9 12L3 9zM3 9h18M9 3l3 6 3-6M12 9v12",
  bank: "M3 21h18M5 21V10M19 21V10M9 21v-7M15 21v-7M2 10l10-7 10 7z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  plus: "M12 5v14M5 12h14",
  more: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  close: "M18 6 6 18M6 6l12 12",
  left: "m15 18-6-6 6-6",
  right: "m9 18 6-6-6-6",
  down: "m6 9 6 6 6-6",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4",
  image: "M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  merge: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9",
  repeat: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01",
  check: "M20 6 9 17l-5-5",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.4 1.3 2.7 2.5 2.7",
  trophy: "M6 9H4a2 2 0 0 1 0-4h2M18 9h2a2 2 0 0 0 0-4h-2M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z",
  wallet: "M20 7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z",
  /* kategorije */
  cart: "M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20h.01M18 20h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  car: "M5 17h14M6 17v2M18 17v2M4 13l2-6h12l2 6v4H4zM7 13h.01M17 13h.01",
  piggy: "M19 9c1 1 2 2 2 4 0 3-3 5-6 5h-4c-4 0-7-2-7-6 0-3 3-6 7-6h3l3-2v3M8 11h.01",
  play: "M5 4l14 8-14 8z",
  shirt: "M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0",
  card: "M2 6h20v13H2zM2 10h20M6 15h4",
  briefcase: "M3 7h18v13H3zM8 7V4h8v3",
  pen: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  coins: "M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8",
} as const;

export type IconName = keyof typeof P;

export function icon(name: IconName, size = 20, label?: string): string {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${a11y}><path d="${P[name]}"/></svg>`;
}

/* ikonica po kategoriji; korisničke kategorije dobijaju „tag" */
const CAT_ICON: Record<string, IconName> = {
  stednja: "piggy", vozilo: "car", dom: "home", racuni: "bolt", potrosnja: "cart",
  pretplate: "play", dugovi: "card", garderoba: "shirt", plata: "briefcase", honorar: "pen", ostalo: "coins",
};
export const catIcon = (id: string): IconName => CAT_ICON[id] || "tag";

/* obojena pločica sa ikonicom kategorije */
export const catTile = (id: string, color: string, small = false): string =>
  `<span class="ico${small ? " sm" : ""}" style="--c:${color.replace(/[^a-zA-Z0-9#()\-,. %]/g, "")}">${icon(catIcon(id), small ? 18 : 20)}</span>`;

/* statičke ikonice u HTML-u: <span data-icon="home"></span> */
export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-icon]").forEach((el) => {
    const name = el.dataset.icon as IconName;
    if (P[name]) el.outerHTML = icon(name, Number(el.dataset.size) || 20);
  });
}
