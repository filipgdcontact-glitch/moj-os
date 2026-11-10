# Moj OS

Lični operativni sistem za obaveze, vreme, projekte i beleške. Radi u pregledaču, instalira se na početni ekran telefona, radi bez interneta i sinhronizuje podatke preko Supabase-a.

## Struktura

- `index.html`, `app.js`, `app.css`, `config.js`, `manifest.webmanifest`, `sw.js`, `icons/`, `vendor/` — gotova aplikacija koju servira GitHub Pages.
- `supabase/schema.sql` — šema baze: tabela `records` sa RLS pravilima (svaki korisnik vidi samo svoje podatke) i Realtime.
- `source/` — izvorni kod (React + esbuild).

## Podaci

- **Sa nalogom:** podaci su u Supabase bazi, vezani za korisnika, i sinhronizuju se uživo na svim uređajima. Izmene bez interneta čekaju u redu i šalju se kad se veza vrati.
- **Bez naloga:** podaci ostaju samo u `localStorage` tog uređaja. Kad se kasnije prijaviš, prenose se na nalog ako je nalog prazan.

`config.js` sadrži URL projekta i publishable (anon) ključ. Taj ključ je namenjen pregledaču; podatke štite RLS pravila u bazi. `service_role` ključ nikad ne ide u ovaj repozitorijum.

## Izmene

```bash
cd source
npm install
python3 build.py          # pravi site/ i dist/
cp -r site/. ..           # kopira gotove fajlove u koren repozitorijuma
```
