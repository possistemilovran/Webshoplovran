export type LocaleBundle = Record<string, unknown>;

type LegacyTexts = Record<string, string>;
type NavRow = { slug: string; label: string };

function giftMsgToI18n(s: string): string {
  return s.replace(/\{gift\}/g, "{{gift}}").replace(/\{amount\}/g, "{{amount}}");
}

/** Iz starog JSON-a (texts, cart, checkout, …) gradi hr granu za localeOverrides. */
export function legacyDiskToHrOverrides(disk: Record<string, unknown>): LocaleBundle {
  const hr: LocaleBundle = {};

  const t = disk.texts as LegacyTexts | undefined;
  if (t && typeof t === "object") {
    const home: Record<string, string> = {};
    const map: [string, keyof LegacyTexts][] = [
      ["eyebrow", "homeEyebrow"],
      ["heroTitle", "homeHeroTitle"],
      ["heroLede", "homeHeroLede"],
      ["ctaPrimary", "homeCtaPrimary"],
      ["ctaSecondary", "homeCtaSecondary"],
      ["sectionRecentTitle", "sectionRecentTitle"],
      ["sectionRecentLink", "sectionRecentLink"],
      ["sectionMoreTitle", "sectionMoreTitle"],
      ["sectionMoreLink", "sectionMoreLink"],
      ["storyEyebrow", "storyEyebrow"],
      ["storyTitle", "storyTitle"],
      ["storyP1", "storyP1"],
      ["storyP2", "storyP2"],
      ["storyButton", "storyButton"],
      ["reviewsTitle", "reviewsTitle"],
      ["ctaTitle", "ctaTitle"],
      ["ctaMuted", "ctaMuted"],
      ["newsletterPlaceholder", "newsletterPlaceholder"],
      ["newsletterButton", "newsletterButton"],
      ["newsletterLabel", "newsletterLabel"],
      ["newsletterDemoAlert", "newsletterDemoAlert"],
    ];
    for (const [jsonKey, textKey] of map) {
      const v = t[textKey];
      if (typeof v === "string" && v) home[jsonKey] = v;
    }
    if (Object.keys(home).length) hr.home = home;

    const footer: Record<string, string> = {};
    if (t.footerBrand) footer.brand = t.footerBrand;
    if (t.footerMuted) footer.muted = t.footerMuted;
    if (t.footerCopyright) footer.copyright = t.footerCopyright;
    if (t.footerShopHeading) footer.shopHeading = t.footerShopHeading;
    if (t.footerAboutHeading) footer.aboutHeading = t.footerAboutHeading;
    if (Object.keys(footer).length) hr.footer = footer;
  }

  const nav = disk.navigation as Record<string, unknown> | undefined;
  if (nav && typeof nav === "object") {
    const n: Record<string, string> = {};
    const pairs: [string, string][] = [
      ["shop", "shopLabel"],
      ["home", "homeLabel"],
      ["contact", "contactLabel"],
      ["about", "aboutLabel"],
      ["blog", "blogLabel"],
      ["allProducts", "allProductsLabel"],
      ["drawerTitle", "drawerTitle"],
      ["searchPlaceholder", "searchPlaceholder"],
      ["searchAria", "searchAria"],
      ["closeMenuAria", "closeMenuAria"],
      ["closeSearchAria", "closeSearchAria"],
    ];
    for (const [jsonKey, navKey] of pairs) {
      const v = nav[navKey];
      if (typeof v === "string" && v) n[jsonKey] = v;
    }
    if (Object.keys(n).length) hr.nav = n;

    const sm = nav.shopSubmenu as NavRow[] | undefined;
    if (Array.isArray(sm)) {
      const cat: Record<string, string> = {};
      for (const row of sm) {
        if (row?.slug && typeof row.label === "string") cat[row.slug] = row.label;
      }
      if (Object.keys(cat).length) hr.categories = cat;
    }
  }

  const ann = disk.announcement as { segments?: string[]; separator?: string } | undefined;
  if (ann?.segments && ann.segments.length > 0) {
    hr.announcement = {
      segments: [...ann.segments],
      ...(typeof ann.separator === "string" ? { separator: ann.separator } : {}),
    };
  }

  const cart = disk.cart as Record<string, unknown> | undefined;
  if (cart && typeof cart === "object") {
    const c: Record<string, string> = {};
    if (typeof cart.giftTitle === "string") c.giftTitle = cart.giftTitle;
    if (typeof cart.giftEligibleMessage === "string")
      c.giftEligible = giftMsgToI18n(cart.giftEligibleMessage);
    if (typeof cart.giftBelowMessage === "string")
      c.giftBelow = giftMsgToI18n(cart.giftBelowMessage);
    if (typeof cart.drawerTitle === "string") c.drawerTitle = cart.drawerTitle;
    if (typeof cart.emptyMessage === "string") c.emptyMessage = cart.emptyMessage;
    if (typeof cart.checkoutButton === "string") c.checkoutButton = cart.checkoutButton;
    if (typeof cart.clearButton === "string") c.clearButton = cart.clearButton;
    if (typeof cart.subtotalLabel === "string") c.subtotalLabel = cart.subtotalLabel;
    if (typeof cart.eachSuffix === "string") c.eachSuffix = cart.eachSuffix;
    if (typeof cart.removeButton === "string") c.removeButton = cart.removeButton;
    if (typeof cart.decreaseQtyAria === "string") c.decreaseQtyAria = cart.decreaseQtyAria;
    if (typeof cart.increaseQtyAria === "string") c.increaseQtyAria = cart.increaseQtyAria;
    if (typeof cart.closeCartAria === "string") c.closeCartAria = cart.closeCartAria;
    if (Object.keys(c).length) hr.cart = c;
  }

  const co = disk.checkout as Record<string, string> | undefined;
  if (co && typeof co === "object") {
    const chk: Record<string, string> = {};
    const keys = [
      "pageTitle",
      "pageNote",
      "emptyTitle",
      "emptyMessage",
      "browseButton",
      "successTitle",
      "successText",
      "continueButton",
      "contactLegend",
      "shippingLegend",
      "emailLabel",
      "nameLabel",
      "addressLabel",
      "cityLabel",
      "zipLabel",
      "countryLabel",
      "submitButton",
      "summaryTitle",
    ] as const;
    for (const k of keys) {
      if (typeof co[k] === "string") chk[k] = co[k];
    }
    if (typeof co.giftIncludedMessage === "string") chk.giftIncluded = co.giftIncludedMessage;
    if (Object.keys(chk).length) hr.checkout = chk;
  }

  const blog = disk.blog as Record<string, string> | undefined;
  if (blog && typeof blog === "object") {
    const blk: Record<string, string> = {};
    if (blog.pageTitle) blk.pageTitle = blog.pageTitle;
    if (blog.pageIntro) blk.pageIntro = blog.pageIntro;
    if (blog.backHomeLabel) blk.backHome = blog.backHomeLabel;
    if (Object.keys(blk).length) hr.blog = blk;
  }

  const pp = disk.productPage as Record<string, string> | undefined;
  if (pp && typeof pp === "object") {
    const pr: Record<string, string> = {};
    for (const k of Object.keys(pp)) {
      if (typeof pp[k] === "string") pr[k] = pp[k];
    }
    if (Object.keys(pr).length) hr.product = pr;
  }

  return hr;
}
