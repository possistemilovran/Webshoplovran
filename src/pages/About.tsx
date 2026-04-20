import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AboutStorySlideshow } from "@/components/AboutStorySlideshow";

export function About() {
  const { t } = useTranslation();
  return (
    <div className="page container page--narrow about-page">
      <p className="eyebrow">{t("about.eyebrow")}</p>
      <h1>{t("about.title")}</h1>
      <AboutStorySlideshow />
      <div className="prose">
        <p>{t("about.p1")}</p>
        <p>{t("about.p2")}</p>
        <p>{t("about.p3")}</p>
      </div>
      <Link to="/shop" className="btn btn--primary">
        {t("about.cta")}
      </Link>
    </div>
  );
}
