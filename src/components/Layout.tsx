import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnnouncementBar } from "./AnnouncementBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";
import { AutoTranslateButton } from "./AutoTranslateButton";

export function Layout() {
  const { t } = useTranslation();
  return (
    <div className="layout">
      <AnnouncementBar />
      <Header />
      <main className="layout__main">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
      <AutoTranslateButton />
      <Link to="/editor" className="editor-launcher">
        {t("layout.editorLauncher")}
      </Link>
      <Link
        to="/urednik-auto"
        className="editor-launcher editor-launcher--auto"
        style={{ bottom: "3.5rem" }}
        title="Novi urednik s automatskim prijevodom (MyMemory)"
      >
        Urednik AUTO
      </Link>
    </div>
  );
}
