# Moj OS

Lični operativni sistem za obaveze, vreme, projekte i beleške. Radi u pregledaču, može se instalirati na početni ekran telefona i radi bez interneta.

## Struktura

- `index.html`, `app.js`, `app.css`, `manifest.webmanifest`, `sw.js`, `icons/`, `vendor/` — gotova aplikacija koju servira GitHub Pages.
- `source/` — izvorni kod (React + esbuild).

## Podaci

Podaci se čuvaju u `localStorage` pregledača na uređaju gde se aplikacija koristi. Repozitorijum ne sadrži nikakve lične podatke; svako ko otvori adresu dobija svoju praznu aplikaciju.

Prenos između uređaja: **Podešavanja → Izvezi**, pa na drugom uređaju **Uvezi**.

Za sinhronizaciju između uređaja planiran je Supabase adapter (`source/src/storage.js`): isti interfejs `start / sync / pending`, jedna tabela po vrsti zapisa sa kolonom `user_id` i RLS pravilima.

## Izmene

```bash
cd source
npm install
python3 build.py          # pravi site/ i dist/
cp -r site/. ..           # kopira gotove fajlove u koren repozitorijuma
```
