# Prelazak na Cloudflare Pages

Aplikacija se od verzije 0.2 gradi (`npm run build` → `dist/`) i ima serverski deo `functions/api/rates.ts`
(zvanične stope). GitHub Pages to ne podržava, Cloudflare Pages podržava — besplatno i sa privatnim repoom.

Redosled je takav da aplikacija **nijednog trenutka ne prestane da radi** i da se **podaci ne izgube**.

## 1. Rezervna kopija podataka (obavezno, na svakom telefonu)

Podaci žive u browseru, vezani za adresu `wand88.github.io`. Nova adresa ih neće videti.

1. Otvori sadašnju aplikaciju na telefonu.
2. **Podaci → Izvezi podatke (JSON)** i sačuvaj fajl (npr. na Google Drive / iCloud / pošalji sebi mejlom).
3. Isto uradi i drugi član domaćinstva na svom telefonu.

## 2. Cloudflare nalog i povezivanje repoa

1. Napravi nalog na <https://dash.cloudflare.com/sign-up> (besplatni plan je dovoljan).
2. **Workers & Pages → Create → Pages → Connect to Git** → poveži GitHub i izaberi repo `Moje-finansije`.
3. Podešavanja builda:
   - **Production branch:** `cloudflare-stope` (privremeno — vidi korak 4)
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variables:** `NODE_VERSION` = `22`
4. **Save and Deploy.** Posle ~1 minut aplikacija je na `https://moje-finansije.pages.dev`
   (tačnu adresu prikazuje Cloudflare). Folder `functions/` Cloudflare sam prepoznaje — `/api/rates` radi odmah.

## 3. Provera i prenos podataka

1. Otvori novu adresu, proveri `https://<adresa>/api/rates` (treba da vrati JSON sa EURIBOR-om i kursom).
2. U aplikaciji: **Podaci → Uvezi i spoji** → izaberi fajl iz koraka 1 (oba fajla ako vas je dvoje).
3. Na telefonu: meni browsera → **Dodaj na početni ekran** (stara ikonica se može obrisati).

## 4. Zatvaranje starog sajta

Tek kad nova adresa radi i podaci su preneti:

1. Spoji granu `cloudflare-stope` u `main` i u Cloudflare-u (Settings → Builds → Production branch) prebaci na `main`.
2. GitHub → repo → **Settings → Pages** → isključi GitHub Pages.
3. GitHub → repo → **Settings → General → Change visibility → Private**.

## Lokalno

```bash
npm run pages:dev
```

Pravi build + Cloudflare okruženje lokalno na <http://127.0.0.1:8788>, uključujući `/api/rates`.
(`npm run dev` je brži za rad na izgledu, ali bez `/api/rates` — aplikacija tada radi sa ručnim stopama.)

## Izvori stopa i licence — proveriti pre komercijalnog lansiranja

| Podatak | Izvor | Napomena |
|---|---|---|
| EURIBOR 3M / 6M | ECB Data API, mesečni prosek | Podatak potiče od EMMI/Refinitiv. **Za komercijalnu upotrebu EURIBOR-a EMMI traži licencu**; besplatni podaci su samo za nekomercijalnu upotrebu. Pre prodaje aplikacije: licenca, ili korisnik sam upisuje stopu iz ugovora. |
| Srednji kurs EUR/RSD | kurs.resenje.org (preuzima preko NBS web servisa) | Nezvaničan posrednik bez objavljenih uslova. Za komercijalnu verziju preći na zvanični NBS web servis (zahteva registraciju na nbs.rs). |
| Referentna stopa NBS | ručno, `src/lib/rates.ts` → `NBS_KEY_RATE` | NBS sajt blokira automatsko čitanje. Ažurirati posle svake odluke Izvršnog odbora. |
| BELIBOR | nije automatski | Nema dostupnog zvaničnog izvora bez registracije; korisnik upisuje ručno. |
