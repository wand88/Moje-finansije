/* ============ Prevodi ============
   Ključevi se dodaju postepeno: tekst koji još nije preveden ostaje direktno u kodu/HTML-u.
   Statički HTML se prevodi atributom data-i18n="ključ" (tekst elementa) ili
   data-i18n-placeholder="ključ" (placeholder polja). */

export type Locale = "sr" | "en";

const sr = {
  "nav.dash": "📊 Pregled",
  "nav.month": "📅 Mesečno",
  "nav.goals": "🎯 Ciljevi",
  "nav.proj": "📈 Projekcija",
  "nav.assets": "💎 Imovina",
  "nav.credit": "🏦 Krediti i auto",
  "nav.data": "⚙️ Podaci",
  "header.subtitle": "Kućni budžet, ciljevi, imovina i krediti — podaci se čuvaju lokalno na tvom uređaju.",
  "header.guide": "❓ Vodič",
  "filter.label": "Prikaz:",
  "filter.all": "Celo domaćinstvo",
  "member.shared": "Zajedničko",
  "member.default": "Član",
  "members.title": "👥 Članovi domaćinstva",
  "members.desc": "Ko sve vodi novac u ovom domaćinstvu — samo ti, par, roditelj sa detetom, cimeri… Svaka stavka može biti nečija ili zajednička.",
  "members.add": "Dodaj člana",
  "members.newName": "Ime novog člana",
  "members.namePh": "npr. Ana",
  "members.rename": "Preimenuj",
  "members.renamePrompt": "Novo ime za „{name}\":",
  "members.remove": "Ukloni",
  "members.removeConfirm": "Ukloniti člana „{name}\"? Njegove stavke ({count}) postaju zajedničke.",
  "members.removeLast": "Domaćinstvo mora imati bar jednog člana.",
  "members.exists": "Član sa tim imenom već postoji.",
  "members.device": "Ko unosi na OVOM uređaju",
  "members.deviceNone": "— nije podešeno —",
  "dialog.ok": "U redu",
  "dialog.cancel": "Otkaži",
  "dialog.confirm": "Potvrdi",
  "dialog.delete": "Obriši",
  "dialog.save": "Sačuvaj",
  "toast.saveFailed": "Podaci nisu sačuvani — memorija uređaja je puna. Napravi rezervnu kopiju.",
  "toast.invalidAmount": "Neispravan iznos.",
  "settings.language": "Jezik",
};

type Key = keyof typeof sr;

const en: Record<Key, string> = {
  "nav.dash": "📊 Overview",
  "nav.month": "📅 Monthly",
  "nav.goals": "🎯 Goals",
  "nav.proj": "📈 Forecast",
  "nav.assets": "💎 Net worth",
  "nav.credit": "🏦 Loans & car",
  "nav.data": "⚙️ Data",
  "header.subtitle": "Household budget, goals, assets and loans — your data stays on your device.",
  "header.guide": "❓ Guide",
  "filter.label": "Show:",
  "filter.all": "Whole household",
  "member.shared": "Shared",
  "member.default": "Member",
  "members.title": "👥 Household members",
  "members.desc": "Who manages money in this household — just you, a couple, a parent and child, roommates… Every item can belong to someone or be shared.",
  "members.add": "Add member",
  "members.newName": "New member's name",
  "members.namePh": "e.g. Anna",
  "members.rename": "Rename",
  "members.renamePrompt": "New name for “{name}”:",
  "members.remove": "Remove",
  "members.removeConfirm": "Remove “{name}”? Their items ({count}) become shared.",
  "members.removeLast": "A household needs at least one member.",
  "members.exists": "A member with that name already exists.",
  "members.device": "Who enters data on THIS device",
  "members.deviceNone": "— not set —",
  "dialog.ok": "OK",
  "dialog.cancel": "Cancel",
  "dialog.confirm": "Confirm",
  "dialog.delete": "Delete",
  "dialog.save": "Save",
  "toast.saveFailed": "Data was not saved — device storage is full. Make a backup.",
  "toast.invalidAmount": "Invalid amount.",
  "settings.language": "Language",
};

const DICTS: Record<Locale, Record<Key, string>> = { sr, en };
const LANG_KEY = "mojeFinansije.lang";

function detect(): Locale {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "sr" || q === "en") return q;
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "sr" || saved === "en") return saved;
  } catch { /* privatni režim / bez localStorage-a */ }
  return "sr";
}

let current: Locale = typeof location !== "undefined" ? detect() : "sr";

export const locale = (): Locale => current;
export const intlLocale = (): string => (current === "en" ? "en-GB" : "sr-RS");

export function setLocale(l: Locale): void {
  current = l;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
}

export function t(key: Key, params?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? sr[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function applyStaticI18n(root: ParentNode = document): void {
  document.documentElement.lang = current;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder as Key);
  });
}
