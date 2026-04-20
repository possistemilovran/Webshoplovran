import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="page container page--narrow">
      <h1>{t("notFound.title")}</h1>
      <p>
        <Link to="/">{t("notFound.linkHome")}</Link>
      </p>
    </div>
  );
}
