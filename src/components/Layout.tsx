import { Outlet } from "react-router-dom";
import { AnnouncementBar } from "./AnnouncementBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";

export function Layout() {
  return (
    <div className="layout">
      <AnnouncementBar />
      <Header />
      <main className="layout__main">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
