# Release checklist — Radionica Lun

## 1) Pre-merge (lokalno)
- `npm ci`
- `npm run qa:quick`
- Ručni pregled:
  - Home, Shop, Product, About, Contact, Blog
  - Jezik prebacivanje (HR/EN/DE/FR/IT/PL/CS)
  - Košarica: dodaj/ukloni/provjeri subtotal
  - Logo i header/footer prikaz na mobilnom i desktopu

## 2) Deploy (GitHub Pages — grana `gh-pages`)
- **Jednokratno u repou:** Settings → Pages → **Build and deployment** → **Source:** **Deploy from a branch**
  - **Branch:** `gh-pages` · **Folder:** `/ (root)` → Save
- Merge / push na `main` pokreće `.github/workflows/deploy-github-pages.yml` (build + push `dist/` na granu `gh-pages`).
- Base putanja u buildu: `/<ime-repa>/` (npr. `/Webshoplovran/` — iz CI varijable `github.event.repository.name`).
- Nakon pusha potvrdi da je workflow završio zeleno, zatim otvori javni URL (vidi Settings → Pages).

## 3) Post-deploy smoke test (produkcija)
- Otvori produkcijski URL i provjeri:
  - `index` učitava bez 404
  - Barem 1 proizvodna kartica se renderira
  - Search otvara rezultate
  - `/pages/about`, `/pages/contact`, `/blogs/news` rade
  - Hard refresh na podstranici ne daje 404 (SPA fallback)

## 4) Rollback plan
- Ako release nije ispravan:
  1. Vrati `main` na zadnji ispravan commit (revert commit, ne force push).
  2. Pričekaj da se GitHub Pages redeploya automatski.
  3. Potvrdi produkcijski smoke test.
  4. Otvori hotfix branch za root cause i ponovi checklistu.

## 5) Operativne napomene
- Uredničke promjene iz `/editor` treba izvesti i spremiti kao verzionirani artefakt.
- Ne koristiti stare logo assete (`logo-handmade-olive*`) kao canonical.
