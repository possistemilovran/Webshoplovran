import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/context/SiteSettingsContext";

export function AnnouncementBar() {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const { enabled } = settings.announcement;
  const raw = t("announcement.segments", { returnObjects: true });
  const segments = Array.isArray(raw) ? (raw as string[]) : [];
  const separator = t("announcement.separator");

  if (!enabled || segments.length === 0) {
    return null;
  }

  const text = segments.join(separator);
  return (
    <div className="announcement" role="region" aria-label={t("nav.announcements")}>
      <div className="announcement__track">
        <span className="announcement__text">{text}</span>
        <span className="announcement__text" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
}
