import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/context/SiteSettingsContext";

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function Blog() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const b = settings.blog;
  const showExternal =
    b.externalUrl.trim() !== "" &&
    b.externalLinkLabel.trim() !== "" &&
    isHttpUrl(b.externalUrl.trim());

  return (
    <div className="page container page--narrow">
      <h1>{t("blog.pageTitle")}</h1>
      <p className="page__lede">{t("blog.pageIntro")}</p>
      <ul className="blog-list" role="list">
        {showExternal && (
          <li>
            <a
              href={b.externalUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
            >
              {b.externalLinkLabel}
            </a>
          </li>
        )}
        <li>
          <Link to="/">{t("blog.backHome")}</Link>
        </li>
      </ul>
    </div>
  );
}
