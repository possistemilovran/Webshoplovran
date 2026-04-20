# Primjer 7 — Radionica Lun (React + Vite aplikacija)

Ovo je puna web-aplikacija nastala spajanjem:

- **logike / funkcionalnosti** iz projekta `C:\corsorextravaganza` (Vite + React + TypeScript webshop s ugrađenim CMS urednikom)
- **dizajna / brenda** iz primjera 7 (`primjer-7-lunjski.html`) — paleta smeđa + maslinasta, logo „Hand Made Olive Wood Croatia", fotografije Lunjskih maslinika

## Struktura (što je gdje)

```
primjer-7/
├── index.html                         ← naslov: „Radionica Lun — …"
├── package.json                       ← React 18 + Vite + i18n + react-router
├── vite.config.ts                     ← dev server na portu 5173
├── public/
│   └── brand/
│       ├── logo-primjer7.png          ← novi logo (tvoj ovalni pečat)
│       ├── logo-handmade-olive.png    ← stari logo (kompatibilnost)
│       ├── lun-hero.jpg               ← hero: stablo staro 1600 god. (Wikimedia)
│       ├── lun-story.jpg              ← „naša priča": panorama maslinika
│       └── showcase-proizvodi.jpg     ← fotografija stvarnih proizvoda
├── src/
│   ├── App.tsx                        ← React Router (Home/Shop/Product/Editor…)
│   ├── index.css                      ← CSS (paleta primjera 7 u :root varijablama)
│   ├── config/siteDefaults.ts         ← ZADANE POSTAVKE — boje, fontovi, slike
│   ├── locales/hr.json                ← svi tekstovi na hrvatskom
│   ├── locales/{en,de,fr,it,pl,cs}.json  ← ostali jezici (još „Olivo Unikat")
│   ├── context/                       ← CartContext, SiteSettingsContext
│   ├── pages/                         ← Home, Shop, Product, Checkout, Editor…
│   ├── components/                    ← Header, Footer, ProductCard, CartDrawer…
│   └── data/                          ← catalog.ts, reviews, types
└── README-PRIMJER7.md                 ← ova datoteka
```

## Što je promijenjeno (dizajn primjera 7 primijenjen na logiku)

### 1. Paleta boja (`src/config/siteDefaults.ts` + `src/index.css`)

| Token            | Prije          | Poslije (primjer 7) |
|------------------|----------------|---------------------|
| pageBackground   | `#f7f5f0`      | `#f3ece0` krem      |
| pageMuted        | `#ebe6dc`      | `#e8dcc3` bež       |
| ink              | `#2c2418`      | `#4a3320` smeđa     |
| inkMuted         | `#5a5348`      | `#7a5330` zemljana  |
| accent           | `#5a6b3a`      | `#6b7d3a` maslina   |
| accentHover      | `#3d4a26`      | `#3f4a22` tam. masl.|
| line             | `#d0c9bc`      | `#a87a4a` svij. sm. |
| announce         | `#3a4228`      | `#2e2014` kora      |

### 2. Slike (`public/brand/`)

- **Hero** (`lun-hero.jpg`) — stablo iz Lunjskih maslinika staro 1600 godina
- **Priča** (`lun-story.jpg`) — panorama rezervata Lunjski maslinici
- **Logo** (`logo-primjer7.png`) — oval „HAND MADE / OLIVE WOOD / CROATIA"
- **Showcase** (`showcase-proizvodi.jpg`) — fotografija stvarnih proizvoda (dostupna za uporabu u CMS uredniku)

### 3. Tekstovi (`src/locales/hr.json`)

- Brand: „Olivo Unikat" → „Radionica Lun" (3 mjesta: footer, copyright, about.title)
- O nama: dopunjeno spominjanjem Lunjskih maslinika na Pagu
- Ostali jezici (en/de/fr/it/pl/cs) još uvijek imaju „Olivo Unikat" — uredi ih kroz `/editor` ili direktno u JSON-ima

### 4. Fontovi (ostavljeno kao što je bilo — već odgovara primjeru 7)

- Naslovi: **Cormorant Garamond** (serif, sličan Georgiji)
- Tekst: **Outfit** (sans-serif)
- Nav: **Archivo Narrow**
- Sve se učitavaju s Google Fontsa + lokalne rezerve u `public/fonts/site/`

## Zadržana funkcionalnost iz `corsorextravaganza`

- **Rute**: `/` (Home), `/shop`, `/collections/:slug`, `/products/:slug`, `/pages/about`, `/pages/contact`, `/blogs/news`, `/checkout`, `/editor`, `/404`
- **Košarica** (drawer s lijeva) — perzistira u localStorage (`olivo-demo-cart`)
- **Višejezičnost** — 7 jezika (HR/EN/DE/FR/IT/PL/CS), prebacivanje u headeru
- **CMS urednik** na `/editor` — boje, fontovi, slike, tekstovi, artikli, prijevodi, arhiva
- **Katalog** — JSON + TypeScript tipovi (`Product`, `Collection`)
- **Proizvodi** — dimenzije (širina/visina/promjer), oblik, sold-out, featured
- **Shopify sync skripte** — `scripts/sync-shopify.mjs` itd.
- **GitHub Pages deploy** — `npm run build:gh-pages`
- **Marquee obavijesti** (traka gore)

## Kako pokrenuti

### 1. Instalacija dependencyja (samo prvi put)

```bash
cd C:\cursor_WEBSITE00\primjer-7
npm install
```

> Trajanje: 2–5 min, preuzima ~300 MB u `node_modules/`.

### 2. Razvojni server (live preview)

```bash
npm run dev
```

Otvori http://localhost:5173 u pregledniku. Svaka izmjena u kodu odmah je vidljiva (hot reload).

### 3. Urednik (CMS)

```bash
npm run dev:editor
```

Ili samo otvori http://localhost:5173/editor. Sve izmjene se spremaju u browseru (localStorage), a mogu se izvesti kao JSON za prijenos u produkciju.

Alternativno: dvoklik na `pokreni_urednik v2.bat` u korijenu.

### 4. Build za produkciju

```bash
npm run build
# rezultat: dist/ mapa — samo statika, hosta se bilo gdje
```

Za GitHub Pages:
```bash
npm run build:gh-pages
```

## Gdje dalje mijenjati dizajn

| Što želiš promijeniti             | Gdje                                                    |
|-----------------------------------|---------------------------------------------------------|
| Boje brenda                       | `src/config/siteDefaults.ts` (DEFAULT_SITE_SETTINGS.colors) **ili** `/editor` |
| Hero sliku                        | `public/brand/lun-hero.jpg` (zamijeni datoteku)         |
| Logo                              | `public/brand/logo-primjer7.png` (zamijeni datoteku)    |
| Naslov hero sekcije               | `src/locales/hr.json` → `home.heroTitle`                |
| Tekst „O nama"                    | `src/locales/hr.json` → `about.*`                       |
| Tekst obavijesti (marquee)        | `src/locales/hr.json` → `announcement.segments`         |
| Fontove                           | `src/config/siteDefaults.ts` → `fonts` **ili** `/editor`|
| Katalog proizvoda                 | `src/data/storeCatalog.json` + `/editor`                |
| Recenzije                         | `src/locales/hr.json` → `reviews`                       |

## Napomena o licenci slika Lunjskih maslinika

Slike u `public/brand/lun-hero.jpg` i `lun-story.jpg` preuzete su s Wikimedia Commonsa pod licencama **CC BY-SA**. Za komercijalnu produkciju navedite autora svake slike (pogledaj `https://commons.wikimedia.org/wiki/Category:Lun_Olive-Gardens`) ili ih zamijeni vlastitim fotografijama.

## Sažetak razlike prema primjeru 7 statičkoj HTML verziji

Statički primjer (`../primjer-7-lunjski.html`) je **jedna HTML datoteka** — dobra za pregled ideje.  
Ova mapa (`primjer-7/`) je **prava aplikacija**:
- izvještava katalog iz JSON-a,
- ima stvarnu košaricu, checkout, pretraživač,
- omogućuje uređivanje kroz web (/editor) bez diranja koda,
- podržava 7 jezika i strojni prijevod,
- gradi se u statične datoteke za hosting na GitHub Pages, Netlify, Vercel…

Koristi statički primjer kao **mood board** za stil, a ovu mapu kao stvarnu stranicu.
