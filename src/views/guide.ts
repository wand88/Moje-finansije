/* ============ Vodič korak-po-korak ============ */
import { state } from "../store";
import { $, showView } from "../ui/dom";
import { icon, type IconName } from "../ui/icons";

const GUIDE_SEEN = "mojeFinansije.guideSeen";

const GUIDE: { badge: string; icon: IconName; title: string; view?: string; body: string }[] = [
  {
    badge: "Dobrodošli", icon: "wallet", title: "Moje finansije — tvoj lični novčani asistent",
    body: `Ova aplikacija ti pomaže da vidiš <b>gde ti novac odlazi</b>, koliko štediš i da li ti se planovi ostvaruju — za tebe i celo domaćinstvo.
      <div class="field-explain"><b>Sve ostaje na tvom uređaju.</b> Podaci se čuvaju samo na ovom uređaju — niko drugi ih ne vidi, nema naloga ni interneta. Zato povremeno napravi rezervnu kopiju (objasnićemo na kraju).</div>
      Kroz par kratkih koraka pokazaćemo ti odakle da počneš. Traje minut.`,
  },
  {
    badge: "Korak 1 / 6", icon: "settings", title: "Podesi osnovne stvari", view: "data",
    body: `Otvorili smo ti <b>Podatke</b> (na telefonu su u meniju <b>Više</b>). Ovde podesi:
      <div class="field-explain"><b>Valuta</b> — u kojoj valuti vodiš račune.</div>
      <div class="field-explain"><b>Članovi domaćinstva</b> — preimenuj sebe i dodaj ostale (partner, dete, cimer…). Ako vodiš samo svoje finansije, ostavi jednog člana. Svaki unos može biti nečiji ili zajednički.</div>
      <div class="field-explain"><b>Ko unosi na ovom uređaju</b> — izaberi sebe. Svaki tvoj unos tada nosi oznaku ko ga je uneo (korisno kad spojite podatke sa drugog telefona).</div>`,
  },
  {
    badge: "Korak 2 / 6", icon: "plus", title: "Unesi prvi prihod (platu)", view: "dash",
    body: `Plavo dugme <b>„+"</b> (na telefonu u sredini donje trake) otvara unos:
      <ul>
        <li>Prebaci na <b>Prihod</b>.</li>
        <li>Upiši iznos, izaberi kategoriju (Plata, Honorar…) i ko je primio.</li>
        <li>Klikni <b>Sačuvaj prihod</b>.</li>
      </ul>
      <div class="field-explain"><b>Zašto je ovo važno:</b> bez prihoda aplikacija ne zna koliko smeš da trošiš ni koliko procenata odvajaš za štednju.</div>`,
  },
  {
    badge: "Korak 3 / 6", icon: "qr", title: "Troškovi — tri brza načina", view: "dash",
    body: `Za svakodnevne <b>troškove</b> imaš tri načina:
      <ul>
        <li><b>Ručno</b> — „+", upiši iznos, izaberi kategoriju. Za česte stavke koristi dugmiće (Kirija, Struja, Gorivo…).</li>
        <li><b>Skeniraj račun</b> — u unosu uslikaj QR kod sa fiskalnog računa, iznos i datum se sami popune.</li>
        <li><b>Uvoz iz banke</b> — u Podacima ubaciš CSV izvod, aplikacija sama razvrsta troškove.</li>
      </ul>
      <div class="field-explain"><b>Garancija do</b> — kad kupiš uređaj ili tehniku, upiši rok garancije. Aplikacija prati koliko je ostalo.</div>`,
  },
  {
    badge: "Korak 4 / 6", icon: "target", title: "Postavi cilj i budžet", view: "goals",
    body: `U tabu <b>Ciljevi</b>:
      <div class="field-explain"><b>Cilj štednje</b> — letovanje, auto, učešće za stan… Upišeš iznos i rok, a aplikacija računa koliko mesečno treba da odvajaš.</div>
      A u <b>Mesečno → Pametni budžet</b>:
      <div class="field-explain"><b>Plan po kategoriji</b> — koliko planiraš da potrošiš. Dugme „Predloži plan (50/30/20)" ga popuni po proverenom pravilu: 50% potrebe, 30% želje, 20% štednja.</div>`,
  },
  {
    badge: "Korak 5 / 6", icon: "home", title: "Prati napredak", view: "dash",
    body: `<b>Pregled</b> je tvoja kontrolna tabla:
      <ul>
        <li><b>Plava kartica</b> — bilans meseca, koliko je plana potrošeno i koliko smeš dnevno.</li>
        <li><b>Gde ide novac</b> — na koje kategorije ide najviše.</li>
        <li><b>Godina</b> — grafikoni, poređenje godina uz uračunatu inflaciju.</li>
        <li><b>Krediti</b> (u meniju Više) — koliki kredit je realan, u evrima ili dinarima.</li>
      </ul>`,
  },
  {
    badge: "Gotovo", icon: "check", title: "Spreman si — samo kreni", view: "data",
    body: `Par saveta za kraj:
      <ul>
        <li><b>Unosi redovno</b> — 2 minuta dnevno ili skeniraj račune u prolazu.</li>
        <li><b>Ponavljajuće</b> — u Mesečnom podesi kiriju i platu jednom, aplikacija te podseća.</li>
        <li><b>Rezervna kopija</b> — povremeno klikni „Izvezi podatke" u Podacima. Tako ne izgubiš ništa i preneseš na drugi uređaj.</li>
      </ul>
      Vodič možeš ponovo otvoriti bilo kad ikonicom upitnika gore desno.`,
  },
];

let idx = 0;

function render(): void {
  const s = GUIDE[idx];
  $("gStepBadge").textContent = s.badge;
  $("gIllus").innerHTML = icon(s.icon, 26);
  $("gTitle").textContent = s.title;
  $("gBody").innerHTML = s.body;
  $("gDots").innerHTML = GUIDE.map((_, i) => `<span class="${i === idx ? "on" : ""}"></span>`).join("");
  $("gBack").style.visibility = idx === 0 ? "hidden" : "visible";
  $("gNext").textContent = idx === GUIDE.length - 1 ? "Kreni" : "Dalje";
  /* prebaci na relevantni tab da korisnik vidi o čemu pričamo */
  if (s.view) showView(s.view);
}

const modal = () => $<HTMLDivElement>("guideModal");

export function openGuide(i = 0): void {
  idx = i;
  render();
  modal().classList.add("open");
  $("gNext").focus();
}

function close(): void {
  modal().classList.remove("open");
  try { localStorage.setItem(GUIDE_SEEN, "1"); } catch { /* ignore */ }
  showView("dash");
  $("btnHelp").focus();
}

export function initGuide(): void {
  $("btnHelp").addEventListener("click", () => openGuide(0));
  $("gNext").addEventListener("click", () => { if (idx < GUIDE.length - 1) { idx++; render(); } else close(); });
  $("gBack").addEventListener("click", () => { if (idx > 0) { idx--; render(); } });
  $("gSkip").addEventListener("click", close);
  modal().addEventListener("click", (e) => { if ((e.target as HTMLElement).id === "guideModal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal().classList.contains("open")) close(); });
  /* prvi put: automatski pokaži vodič ako nema podataka i nije već viđen */
  try {
    if (!localStorage.getItem(GUIDE_SEEN) && state.tx.length === 0) openGuide(0);
  } catch { /* ignore */ }
}
