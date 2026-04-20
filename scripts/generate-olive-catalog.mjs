/**
 * Generates storeCatalog.json: max 200 products, 13 olive-wood categories.
 * Run: node scripts/generate-olive-catalog.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "../src/data/storeCatalog.json");

const imgs = [
  "https://images.unsplash.com/photo-1604719312566-8912e9227c6e?w=900&q=80",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&q=80",
  "https://images.unsplash.com/photo-1615876234846-5fd39d7abe5a?w=900&q=80",
  "https://images.unsplash.com/photo-1503602642458-232111445657?w=900&q=80",
  "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=900&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=900&q=80",
];

function pick(i) {
  return imgs[i % imgs.length];
}

const collectionDefs = [
  {
    id: "col-stolne-lampe",
    slug: "stolne-lampe",
    title: "Stolne lampe",
    description:
      "Ručno obrađene stolne lampe od maslinovog drveta. Svaki komad je jedinstven zbog prirodnog žila drveta.",
  },
  {
    id: "col-zdjele-voce",
    slug: "zdjele-za-voce",
    title: "Zdjele za voće",
    description:
      "Prostrane zdjele za voće i ukras. Maslinovo drvo dugo zadržava svoju ljepotu i prirodan sjaj.",
  },
  {
    id: "col-zdjelice-srednje",
    slug: "zdjelice-srednje",
    title: "Zdjelice srednje",
    description:
      "Srednje veličine zdjelice za salate, priloge ili ukras na stolu.",
  },
  {
    id: "col-zdjelice-male",
    slug: "zdjelice-male",
    title: "Zdjelice male",
    description:
      "Male zdjelice za začine, orašaste plodove ili kao sitni ukrasni predmeti.",
  },
  {
    id: "col-daske",
    slug: "daske",
    title: "Daske",
    description:
      "Daske za rezanje i posluživanje od maslinovog drveta — izdržljive i lijepe.",
  },
  {
    id: "col-kuhace",
    slug: "kuhace",
    title: "Kuhače",
    description:
      "Kuhače i varjače od drveta, ugodne na dodir i sigurne za posuđe.",
  },
  {
    id: "col-kuhinjski-pribor",
    slug: "kuhinjski-pribor",
    title: "Kuhinjski pribor",
    description:
      "Žlice, vilice i ostali kuhinjski pribor od maslinovog drveta.",
  },
  {
    id: "col-kutijice",
    slug: "kutijice",
    title: "Kutijice",
    description:
      "Ukrasne kutijice za nakit, začine ili uspomene — ručni rad.",
  },
  {
    id: "col-svijecnjaci",
    slug: "svijecnjaci",
    title: "Svijećnjaci",
    description:
      "Svijećnjaci koji stvaraju toplu atmosferu; svaki komad je unikat.",
  },
  {
    id: "col-stalci-case",
    slug: "stalci-za-case",
    title: "Stalci za čaše",
    description:
      "Stalci i držači za čaše i pribor za posluživanje pića.",
  },
  {
    id: "col-satovi",
    slug: "satovi",
    title: "Satovi",
    description:
      "Zidni i stolni satovi s kucanjem od maslinovog drveta.",
  },
  {
    id: "col-pladnjevi",
    slug: "pladnjevi-posluzavnici",
    title: "Pladnjevi i poslužavnici",
    description:
      "Pladnjevi i poslužavnici za kavu, desert ili predjela.",
  },
  {
    id: "col-ostalo",
    slug: "ostalo-maslinovo",
    title: "Ostali unikatni predmeti od maslinovog drveta",
    description:
      "Razni ručni radovi i sitni predmeti koji ne ulaze u ostale kategorije.",
  },
];

// 5×16 + 8×15 = 200
const counts = [16, 16, 16, 16, 16, 15, 15, 15, 15, 15, 15, 15, 15];

function titleFor(catIndex, i) {
  const p = [
    () => `Stolna lampa od maslinovog drveta — serija ${i}`,
    () => `Zdjela za voće, ručni rad — model ${i}`,
    () => `Srednja zdjelica od maslinovog drveta — ${i}`,
    () => `Mala zdjelica / zdjelica za začine — ${i}`,
    () => `Daska za rezanje / serviranje — ${i}`,
    () => `Kuhalica od maslinovog drveta — ${i}`,
    () => `Komad kuhinjskog pribora — ${i}`,
    () => `Kutijica od maslinovog drveta — ${i}`,
    () => `Svijećnjak od maslinovog drveta — ${i}`,
    () => `Stalak za čaše — ${i}`,
    () => `Sat s okvirom od maslinovog drveta — ${i}`,
    () => `Pladanj / poslužavnik — ${i}`,
    () => `Unikat od maslinovog drveta — ${i}`,
  ];
  return p[catIndex]();
}

const collections = collectionDefs.map((c, ci) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  description: c.description,
  heroImage: pick(ci + 2),
}));

const products = [];
let globalIdx = 0;

collectionDefs.forEach((c, ci) => {
  const n = counts[ci];
  for (let i = 1; i <= n; i++) {
    globalIdx += 1;
    const slug = `${c.slug}-komad-${i}`;
    const id = `olm-${c.slug}-${i}`;
    const title = titleFor(ci, i);
    const img = pick(globalIdx);
    const price = 24.9 + (globalIdx % 17) * 7.5 + (ci % 3) * 12;
    const featured = globalIdx <= 12;
    products.push({
      id,
      slug,
      title,
      price: Math.round(price * 100) / 100,
      currency: "EUR",
      image: img,
      images: [img, pick(globalIdx + 1)],
      collectionIds: [c.id],
      shortDescription:
        "Ručno obrađen komad od maslinovog drveta. Tekstura i boja su prirodne — svaki predmet je jedinstven.",
      description:
        "Ovaj predmet izrađen je od maslinovog drveta poznatog po gustoj strukturi i dugotrajnosti. Prikladno za svakodnevnu uporabu ili kao ukras. Prije prve uporabe preporučujemo blago uljenje drveta za očuvanje sjaja. Ne preporučuje se perilica posuđa.",
      soldOut: false,
      featured,
    });
  }
});

const catalog = {
  currency: "EUR",
  collections,
  products,
};

writeFileSync(out, JSON.stringify(catalog));
console.log("Wrote", out, "collections:", collections.length, "products:", products.length);
