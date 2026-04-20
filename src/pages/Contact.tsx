import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Contact() {
  const { t } = useTranslation();
  return (
    <div className="page container page--narrow">
      <h1>{t("contact.title")}</h1>
      <div className="prose">
        <p>{t("contact.p1")}</p>
        <p>
          <Link to="/shop">{t("contact.linkShop")}</Link>
        </p>
      </div>
    </div>
  );
}
