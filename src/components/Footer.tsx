import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { publicAssetUrl } from "@/lib/publicUrl";

export function Footer() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const logoUrl = settings.images.logo;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner container">
        <div>
          <div className="site-footer__brand-row">
            {logoUrl?.trim() ? (
              <img
                className="site-footer__logo"
                src={publicAssetUrl(logoUrl)}
                alt=""
                width={72}
                height={72}
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <p className="site-footer__brand">{t("footer.brand")}</p>
          </div>
          <p className="site-footer__muted">{t("footer.muted")}</p>
        </div>
        <div className="site-footer__cols">
          <div>
            <p className="site-footer__heading">{t("footer.shopHeading")}</p>
            <ul className="site-footer__list">
              <li>
                <Link to="/collections/stolne-lampe">
                  {t("footer.linkLamps")}
                </Link>
              </li>
              <li>
                <Link to="/shop">{t("footer.linkAll")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="site-footer__heading">{t("footer.aboutHeading")}</p>
            <ul className="site-footer__list">
              <li>
                <Link to="/pages/about">{t("footer.linkAbout")}</Link>
              </li>
              <li>
                <Link to="/pages/contact">{t("footer.linkContact")}</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="site-footer__bar container">
        <span>
          © {new Date().getFullYear()} {t("footer.copyright")}
        </span>
      </div>
    </footer>
  );
}
