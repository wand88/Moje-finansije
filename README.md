# Moje finansije

Kućni budžet, ciljevi, imovina i krediti — PWA koja radi offline, podaci ostaju na uređaju.

## Komande

```bash
npm install        # jednom, posle kloniranja
npm run dev        # razvoj: http://localhost:5173
npm test           # jedinični testovi (finansijska matematika, CSV, fiskalni QR, migracija, spajanje)
npm run build      # provera tipova + produkcijski build u dist/
npm run preview    # pregled build-a lokalno
```

## Struktura

```
index.html           markup svih tabova
public/              manifest, ikonice, service worker (kopira se 1:1 u dist/)
src/main.ts          ulazna tačka
src/types.ts         model podataka
src/store.ts         stanje + čuvanje u localStorage
src/model.ts         kategorije, članovi domaćinstva, filteri, format brojeva
src/i18n.ts          prevodi (sr, en)
src/lib/             čista logika bez DOM-a — pokrivena testovima u tests/
src/ui/              DOM pomoćnici, SVG grafikoni, dijalozi i obaveštenja
src/views/           jedan modul po tabu/celini
```

## Podaci

Sve se čuva pod ključem `mojeFinansije.v1` u localStorage-u. Stari format (muž/žena, jedan `index.html`)
se pri učitavanju automatski prevodi u novi (`src/lib/migrate.ts`) — postojeći ID-jevi `muz`/`zena` ostaju isti.

## Objavljivanje

Hosting servira **sadržaj `dist/` foldera** posle `npm run build` (npr. Cloudflare Pages: build komanda
`npm run build`, izlazni folder `dist`). Koren repozitorijuma više nije spreman za direktno serviranje.
Podaci u localStorage-u su vezani za adresu sajta — pri prelasku na novu adresu prvo izvezi rezervnu kopiju
(⚙️ Podaci → Izvezi) pa je uvezi na novoj adresi.
