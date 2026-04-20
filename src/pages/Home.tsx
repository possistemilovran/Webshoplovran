import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ProductCard } from "@/components/ProductCard";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useResolvedProducts } from "@/hooks/useResolvedCatalog";
import { productIsListedInStorefront } from "@/lib/productListing";
import { publicAssetUrl } from "@/lib/publicUrl";

type ReviewItem = { quote: string; author: string; location: string };

export function Home() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const img = settings.images;
  const products = useResolvedProducts();

  const listed = useMemo(() => {
    const ov = settings.productOverrides;
    return products.filter((p) =>
      productIsListedInStorefront(p, ov[p.slug] ?? ov[p.id] ?? null)
    );
  }, [products, settings.productOverrides]);

  const recent = useMemo(
    () => listed.filter((p) => p.featured).slice(0, 8),
    [listed]
  );
  const more = useMemo(
    () => listed.filter((p) => !p.featured).slice(0, 4),
    [listed]
  );
  const rawReviews = t("reviews", { returnObjects: true });
  const testimonialShow = useMemo(() => {
    if (!Array.isArray(rawReviews)) return [];
    return (rawReviews as ReviewItem[]).slice(0, 6);
  }, [rawReviews]);

  const heroUrl = img.heroBackground.trim();
  const heroBg = heroUrl
    ? `linear-gradient(
      180deg,
      rgba(247, 245, 240, 0.15) 0%,
      rgba(247, 245, 240, 0.92) 100%
    ),
    url(${publicAssetUrl(heroUrl)})`
    : `linear-gradient(
      180deg,
      rgba(247, 245, 240, 0.35) 0%,
      rgba(247, 245, 240, 0.98) 100%
    )`;

  return (
    <>
      <section className="hero">
        <div
          className="hero__bg"
          aria-hidden
          style={{ backgroundImage: heroBg }}
        />
        <div className="hero__content container">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1 className="hero__title">{t("home.heroTitle")}</h1>
          <p className="hero__lede">{t("home.heroLede")}</p>
          <div className="hero__actions">
            <Link to="/collections/stolne-lampe" className="btn btn--primary">
              {t("home.ctaPrimary")}
            </Link>
            <Link to="/shop" className="btn btn--ghost">
              {t("home.ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section__head">
          <h2>{t("home.sectionRecentTitle")}</h2>
          <Link to="/collections/stolne-lampe" className="link-arrow">
            {t("home.sectionRecentLink")}
          </Link>
        </div>
        <div className="product-grid">
          {recent.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="section section--muted">
        <div className="container">
          <div className="section__head">
            <h2>{t("home.sectionMoreTitle")}</h2>
            <Link to="/shop" className="link-arrow">
              {t("home.sectionMoreLink")}
            </Link>
          </div>
          <div className="product-grid product-grid--compact">
            {more.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="showcase" aria-label={t("home.showcaseEyebrow")}>
        <div className="container showcase__inner">
          <p className="eyebrow">{t("home.showcaseEyebrow")}</p>
          <h3 className="showcase__title">{t("home.showcaseTitle")}</h3>
          <p className="showcase__lede">{t("home.showcaseLede")}</p>
          <div className="showcase__stats">
            <div>
              <div className="showcase__stat-n">{t("home.showcaseStat1N")}</div>
              <div className="showcase__stat-l">{t("home.showcaseStat1L")}</div>
            </div>
            <div>
              <div className="showcase__stat-n">{t("home.showcaseStat2N")}</div>
              <div className="showcase__stat-l">{t("home.showcaseStat2L")}</div>
            </div>
            <div>
              <div className="showcase__stat-n">{t("home.showcaseStat3N")}</div>
              <div className="showcase__stat-l">{t("home.showcaseStat3L")}</div>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`section container story-block${img.storyImage.trim() ? "" : " story-block--text-only"}`}
      >
        <div className="story-block__text">
          <p className="eyebrow">{t("home.storyEyebrow")}</p>
          <h2>{t("home.storyTitle")}</h2>
          <p>{t("home.storyP1")}</p>
          <p>{t("home.storyP2")}</p>
          <Link to="/pages/about" className="btn btn--ghost">
            {t("home.storyButton")}
          </Link>
        </div>
        {img.storyImage.trim() ? (
          <div className="story-block__media">
            <img
              src={publicAssetUrl(img.storyImage)}
              alt=""
              loading="lazy"
              width={640}
              height={800}
            />
          </div>
        ) : null}
      </section>

      <section className="section section--reviews">
        <div className="container">
          <h2 className="reviews__title">{t("home.reviewsTitle")}</h2>
          <div className="reviews-grid">
            {testimonialShow.map((r, i) => (
              <blockquote key={i} className="review-card">
                <p>“{r.quote}”</p>
                <footer>
                  {r.author}, {r.location}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="section container cta-band">
        <div>
          <h2>{t("home.ctaTitle")}</h2>
          <p className="cta-band__muted">{t("home.ctaMuted")}</p>
        </div>
        <form
          className="cta-band__form"
          onSubmit={(e) => {
            e.preventDefault();
            alert(t("home.newsletterDemoAlert"));
          }}
        >
          <label className="visually-hidden" htmlFor="newsletter-email">
            {t("home.newsletterLabel")}
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            placeholder={t("home.newsletterPlaceholder")}
            className="input"
          />
          <button type="submit" className="btn btn--primary">
            {t("home.newsletterButton")}
          </button>
        </form>
      </section>
    </>
  );
}
