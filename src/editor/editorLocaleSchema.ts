/** Polja i18n u uređivaču (usklađeno s hr.json / stranicama). */

export type EditorI18nField =
  | {
      kind: "text";
      path: (string | number)[];
      label: string;
      multiline?: boolean;
      hint?: string;
    }
  | {
      kind: "lines";
      path: (string | number)[];
      label: string;
      hint?: string;
    };

export type EditorI18nGroup = {
  id: string;
  title: string;
  hint?: string;
  fields: EditorI18nField[];
};

const T = (
  path: (string | number)[],
  label: string,
  o?: { multiline?: boolean; hint?: string }
): EditorI18nField => ({
  kind: "text",
  path,
  label,
  multiline: o?.multiline,
  hint: o?.hint,
});

const L = (path: (string | number)[], label: string, hint?: string): EditorI18nField => ({
  kind: "lines",
  path,
  label,
  hint,
});

export const EDITOR_I18N_GROUPS: EditorI18nGroup[] = [
  // NAMJERNO NEMA grupe „lang" (nazivi jezika).
  //
  // Svaki bundlani locale JSON (`src/locales/<code>.json`) već ima točna imena
  // jezika (npr. `"hr": "Croatian"` u EN-u, `"hr": "Kroatisch"` u DE-u, …).
  // Strojni prijevod tih izoliranih jednorječnih stringova preko MyMemory-a
  // vraća besmislene/pogrešne rezultate („Hrvatski" → „English" u EN), što je
  // u dropdownu jezika dovodilo do duplih naziva i nemogućnosti povratka na
  // HR. Zato ih NIKAD ne obrađuje auto-translator i ne nude se u uredniku —
  // bundlani podaci su autoritativni i pokriveni svim 8 jezika.
  {
    id: "nav",
    title: "Navigacija i pristupačnost",
    hint: "Kategorije u podizborniku dolaze iz odjeljka „Struktura trgovine”; slug mora ostati isti kao u URL-u.",
    fields: [
      T(["nav", "home"], "Početna"),
      T(["nav", "shop"], "Trgovina"),
      T(["nav", "contact"], "Kontakt"),
      T(["nav", "about"], "O nama"),
      T(["nav", "blog"], "Blog"),
      T(["nav", "allProducts"], "Svi artikli"),
      T(["nav", "drawerTitle"], "Naslov mobilne ladice"),
      T(["nav", "searchPlaceholder"], "Placeholder pretrage"),
      T(["nav", "searchAria"], "ARIA pretraga"),
      T(["nav", "closeMenuAria"], "ARIA zatvori izbornik"),
      T(["nav", "closeSearchAria"], "ARIA zatvori pretragu"),
      T(["nav", "shopSubmenuAria"], "ARIA podizbornik trgovine"),
      T(["nav", "mainNav"], "ARIA glavni izbornik"),
      T(["nav", "announcements"], "ARIA traka obavijesti"),
    ],
  },
  {
    id: "announcement",
    title: "Traka obavijesti (marquee)",
    fields: [
      L(["announcement", "segments"], "Segmenti (jedan po retku)", "Prikazuje se samo ako je traka uključena u postavkama izgleda."),
      T(["announcement", "separator"], "Separator između segmenta"),
    ],
  },
  {
    id: "home",
    title: "Početna stranica",
    fields: [
      T(["home", "eyebrow"], "Mali naslov (eyebrow)"),
      T(["home", "heroTitle"], "Glavni naslov", { multiline: false }),
      T(["home", "heroLede"], "Uvod ispod naslova", { multiline: true }),
      T(["home", "ctaPrimary"], "Gumb 1"),
      T(["home", "ctaSecondary"], "Gumb 2"),
      T(["home", "sectionRecentTitle"], "Sekcija izdvojeno — naslov"),
      T(["home", "sectionRecentLink"], "Sekcija izdvojeno — link"),
      T(["home", "sectionMoreTitle"], "Sekcija više — naslov"),
      T(["home", "sectionMoreLink"], "Sekcija više — link"),
      T(["home", "storyEyebrow"], "Priča — eyebrow"),
      T(["home", "storyTitle"], "Priča — naslov"),
      T(["home", "storyP1"], "Priča — odlomak 1", { multiline: true }),
      T(["home", "storyP2"], "Priča — odlomak 2", { multiline: true }),
      T(["home", "storyButton"], "Priča — gumb"),
      T(["home", "reviewsTitle"], "Naslov bloka recenzija"),
      T(["home", "ctaTitle"], "Newsletter — naslov"),
      T(["home", "ctaMuted"], "Newsletter — opis", { multiline: true }),
      T(["home", "newsletterPlaceholder"], "Newsletter — placeholder"),
      T(["home", "newsletterButton"], "Newsletter — gumb"),
      T(["home", "newsletterLabel"], "Newsletter — skrivena oznaka polja"),
      T(["home", "newsletterDemoAlert"], "Newsletter — demo alert", { multiline: true }),
    ],
  },
  {
    id: "reviews",
    title: "Recenzije (6 kartica)",
    fields: [0, 1, 2, 3, 4, 5].flatMap((i) => [
      T(["reviews", i, "quote"], `Recenzija ${i + 1} — citat`, { multiline: true }),
      T(["reviews", i, "author"], `Recenzija ${i + 1} — autor`),
      T(["reviews", i, "location"], `Recenzija ${i + 1} — mjesto`),
    ]),
  },
  {
    id: "footer",
    title: "Podnožje",
    fields: [
      T(["footer", "brand"], "Marka"),
      T(["footer", "muted"], "Opis", { multiline: true }),
      T(["footer", "copyright"], "Copyright (kratko ime)"),
      T(["footer", "shopHeading"], "Stupac — trgovina"),
      T(["footer", "aboutHeading"], "Stupac — informacije"),
      T(["footer", "linkLamps"], "Poveznica — stolne lampe"),
      T(["footer", "linkAll"], "Poveznica — svi artikli"),
      T(["footer", "linkAbout"], "Poveznica — o nama"),
      T(["footer", "linkContact"], "Poveznica — kontakt"),
      T(["footer", "editor"], "Poveznica — uredi stranicu"),
    ],
  },
  {
    id: "cart",
    title: "Košarica",
    fields: [
      T(["cart", "giftTitle"], "Naziv demo poklona"),
      T(["cart", "giftEligible"], "Poruka kad je prag dosegnut", {
        multiline: true,
        hint: "Koristi {{gift}} za naziv poklona.",
      }),
      T(["cart", "giftBelow"], "Poruka ispod praga", {
        multiline: true,
        hint: "Koristi {{amount}} za iznos praga.",
      }),
      T(["cart", "drawerTitle"], "Naslov ladice"),
      T(["cart", "emptyMessage"], "Prazna košarica"),
      T(["cart", "checkoutButton"], "Gumb naplata"),
      T(["cart", "clearButton"], "Gumb isprazni"),
      T(["cart", "subtotalLabel"], "Oznaka međuzbroja"),
      T(["cart", "eachSuffix"], "Sufiks uz cijenu"),
      T(["cart", "removeButton"], "Gumb ukloni"),
      T(["cart", "decreaseQtyAria"], "ARIA smanji količinu"),
      T(["cart", "increaseQtyAria"], "ARIA povećaj količinu"),
      T(["cart", "closeCartAria"], "ARIA zatvori košaricu"),
    ],
  },
  {
    id: "checkout",
    title: "Naplata",
    fields: [
      T(["checkout", "pageTitle"], "Naslov stranice"),
      T(["checkout", "pageNote"], "Napomena", { multiline: true }),
      T(["checkout", "emptyTitle"], "Prazna košarica — naslov"),
      T(["checkout", "emptyMessage"], "Prazna košarica — tekst"),
      T(["checkout", "browseButton"], "Gumb pregledaj artikle"),
      T(["checkout", "successTitle"], "Zahvala — naslov"),
      T(["checkout", "successText"], "Zahvala — tekst", { multiline: true }),
      T(["checkout", "continueButton"], "Gumb natrag u trgovinu"),
      T(["checkout", "contactLegend"], "Legenda kontakt"),
      T(["checkout", "shippingLegend"], "Legenda dostava"),
      T(["checkout", "emailLabel"], "Oznaka e-pošta"),
      T(["checkout", "nameLabel"], "Oznaka ime"),
      T(["checkout", "addressLabel"], "Oznaka adresa"),
      T(["checkout", "cityLabel"], "Oznaka grad"),
      T(["checkout", "zipLabel"], "Oznaka poštanski broj"),
      T(["checkout", "countryLabel"], "Oznaka država"),
      T(["checkout", "submitButton"], "Gumb pošalji"),
      T(["checkout", "summaryTitle"], "Naslov sažetka"),
      T(["checkout", "giftIncluded"], "Poruka o poklonu u sažetku", { multiline: true }),
    ],
  },
  {
    id: "blog",
    title: "Blog (tekst stranice)",
    hint: "Vanjski URL i oznaka poveznice i dalje su u odjeljku „Blog — poveznica”.",
    fields: [
      T(["blog", "pageTitle"], "Naslov stranice"),
      T(["blog", "pageIntro"], "Uvod", { multiline: true }),
      T(["blog", "backHome"], "Poveznica natrag na početnu"),
    ],
  },
  {
    id: "product",
    title: "Stranica proizvoda i mreža",
    fields: [
      T(["product", "addToCart"], "Gumb dodaj u košaricu"),
      T(["product", "soldOut"], "Rasprodano (PDP)"),
      T(["product", "soldOutShort"], "Rasprodano (kratko)"),
      T(["product", "fact1"], "Činjenica 1"),
      T(["product", "fact2"], "Činjenica 2"),
      T(["product", "fact3"], "Činjenica 3"),
      T(["product", "collectionsFallback"], "Zamjena kad nema kolekcija"),
      T(["product", "imageThumb"], "ARIA sličica ({{n}})", {
        hint: "Zadrži {{n}} za redni broj.",
      }),
      T(["product", "notFoundTitle"], "Proizvod nije pronađen"),
      T(["product", "notFoundLink"], "Poveznica natrag u trgovinu"),
    ],
  },
  {
    id: "shop",
    title: "Trgovina (katalog)",
    fields: [
      T(["shop", "eyebrow"], "Eyebrow"),
      T(["shop", "title"], "Naslov"),
      T(["shop", "searchIntro"], "Uvod uz pretragu", {
        hint: "Zadrži {{query}}.",
      }),
      T(["shop", "oneResult"], "Riječ „rezultat” (jednina)"),
      T(["shop", "manyResults"], "Riječ „rezultata” (množina)"),
      T(["shop", "ledeDefault"], "Uvod bez pretrage", { multiline: true }),
    ],
  },
  {
    id: "collection",
    title: "Kolekcija",
    fields: [
      T(["collection", "notFoundTitle"], "Kolekcija nije pronađena"),
      T(["collection", "notFoundLink"], "Poveznica"),
      T(["collection", "heroEyebrow"], "Eyebrow na hero slici"),
      T(["collection", "empty"], "Prazna kolekcija"),
    ],
  },
  {
    id: "about",
    title: "O nama",
    fields: [
      T(["about", "eyebrow"], "Eyebrow"),
      T(["about", "title"], "Naslov"),
      T(["about", "p1"], "Odlomak 1", { multiline: true }),
      T(["about", "p2"], "Odlomak 2", { multiline: true }),
      T(["about", "p3"], "Odlomak 3", { multiline: true }),
      T(["about", "cta"], "Gumb u trgovinu"),
    ],
  },
  {
    id: "contact",
    title: "Kontakt",
    fields: [
      T(["contact", "title"], "Naslov"),
      T(["contact", "p1"], "Tekst", { multiline: true }),
      T(["contact", "linkShop"], "Poveznica u trgovinu"),
    ],
  },
  {
    id: "notFound",
    title: "404",
    fields: [
      T(["notFound", "title"], "Naslov"),
      T(["notFound", "linkHome"], "Poveznica"),
    ],
  },
  {
    id: "layout",
    title: "Globalno / plutajući gumb",
    fields: [T(["layout", "editorLauncher"], "Tekst gumba „Uredi stranicu”")],
  },
];
