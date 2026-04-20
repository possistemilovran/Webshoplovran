import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { productGridHash } from "@/hooks/useScrollToProductGrid";
import { SUPPORTED_LANGS } from "@/i18n";
import { publicAssetUrl } from "@/lib/publicUrl";

function IconSearch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 19"
      fill="none"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.03 11.68A5.784 5.784 0 112.85 3.5a5.784 5.784 0 018.18 8.18zm.26 1.12a6.78 6.78 0 11.72-.7l5.4 5.4a.5.5 0 11-.71.7l-5.41-5.4z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 17"
      fill="none"
      aria-hidden
    >
      <path
        d="M.865 15.978a.5.5 0 00.707.707l7.433-7.431 7.579 7.282a.501.501 0 00.846-.37.5.5 0 00-.153-.351L9.712 8.546l7.417-7.416a.5.5 0 10-.707-.708L8.991 7.853 1.413.573a.5.5 0 10-.693.72l7.563 7.268-7.418 7.417z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconHamburger({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M1 .5a.5.5 0 100 1h15.71a.5.5 0 000-1H1zM.5 8a.5.5 0 01.5-.5h15.71a.5.5 0 010 1H1A.5.5 0 01.5 8zm0 7a.5.5 0 01.5-.5h15.71a.5.5 0 010 1H1a.5.5 0 01-.5-.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconAccount({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 19"
      fill="none"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 4.5a3 3 0 116 0 3 3 0 01-6 0zm3-4a4 4 0 100 8 4 4 0 000-8zm5.58 12.15c1.12.82 1.83 2.24 1.91 4.85H1.51c.08-2.6.79-4.03 1.9-4.85C4.66 11.75 6.5 11.5 9 11.5s4.35.26 5.58 1.15zM9 10.5c-2.5 0-4.65.24-6.17 1.35C1.27 12.98.5 14.93.5 18v.5h17V18c0-3.07-.77-5.02-2.33-6.15-1.52-1.1-3.67-1.35-6.17-1.35z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconCart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
    >
      <path
        d="m15.75 11.8h-3.16l-.77 11.6a5 5 0 0 0 4.99 5.34h7.38a5 5 0 0 0 4.99-5.33l-.78-11.61zm0 1h-2.22l-.71 10.67a4 4 0 0 0 3.99 4.27h7.38a4 4 0 0 0 4-4.27l-.72-10.67h-2.22v.63a4.75 4.75 0 1 1 -9.5 0zm8.5 0h-7.5v.63a3.75 3.75 0 1 0 7.5 0z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

function IconCaret({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 6" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.354.646a.5.5 0 00-.708 0L5 4.293 1.354.646a.5.5 0 00-.708.708l4 4a.5.5 0 00.708 0l4-4a.5.5 0 000-.708z"
        fill="currentColor"
      />
    </svg>
  );
}

function cartCount(lines: { quantity: number }[]) {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

function navClass(active: boolean) {
  return `header-dawn__menu-link${active ? " header-dawn__menu-link--active" : ""}`;
}

export function Header() {
  const { t, i18n } = useTranslation();
  const { settings } = useSiteSettings();
  const nav = settings.navigation;
  const shopItems = nav.shopSubmenu.filter((x) => x.slug.trim() !== "");

  const { lines, setOpen } = useCart();
  const count = cartCount(lines);
  const navigate = useNavigate();
  const location = useLocation();
  const searchId = useId();
  const shopDetailsRef = useRef<HTMLDetailsElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const closeShopDropdown = () => {
    shopDetailsRef.current?.removeAttribute("open");
  };

  useEffect(() => {
    closeShopDropdown();
  }, [location.pathname, location.search]);

  /** Stvarna visina ljepljivog bloka zaglavlja → mega izbornik ispod glave, bez prekrivanja proizvoda */
  useEffect(() => {
    const root = document.documentElement;
    const el = headerWrapperRef.current;
    if (!el) return;

    const sync = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty("--site-header-height", `${h}px`);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      root.style.removeProperty("--site-header-height");
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  /** <details> ne zatvara se sam od sebe klikom izvan — mega izbornik ostaje „zaglavljen”. */
  useEffect(() => {
    const details = shopDetailsRef.current;
    if (!details) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (!details.open) return;
      const target = e.target;
      if (target instanceof Node && details.contains(target)) return;
      details.removeAttribute("open");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !details.open) return;
      details.removeAttribute("open");
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setSearchOpen(false);
    setDrawerOpen(false);
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  };

  const closeAll = () => {
    setDrawerOpen(false);
    setSearchOpen(false);
  };

  return (
    <>
      <div ref={headerWrapperRef} className="header-dawn-wrapper">
        <header className="header-dawn container">
          <div className="header-dawn__row1">
            <div className="header-dawn__row1-start">
              <div className="header-dawn__left-tools">
                <button
                  type="button"
                  className="header-dawn__icon-btn header-dawn__only-mobile-nav"
                  aria-label={t("nav.drawerTitle")}
                  aria-expanded={drawerOpen}
                  onClick={() => setDrawerOpen(true)}
                >
                  <IconHamburger className="header-dawn__icon header-dawn__icon--menu" />
                </button>
                <button
                  type="button"
                  className="header-dawn__icon-btn header-dawn__only-tiny-search"
                  aria-label={t("nav.searchAria")}
                  onClick={() => setSearchOpen(true)}
                >
                  <IconSearch className="header-dawn__icon" />
                </button>
              </div>

              <h1 className="header-dawn__heading">
                <Link
                  to="/"
                  className="header-dawn__heading-link header-dawn__brand-link"
                  onClick={closeAll}
                >
                  <span className="header-dawn__logo-wrap">
                    <img
                      src={publicAssetUrl(settings.images.logo)}
                      alt=""
                      width={366}
                      height={450}
                      className="header-dawn__logo-mark"
                      decoding="async"
                    />
                  </span>
                  <span className="header-dawn__brand-name">{t("footer.brand")}</span>
                </Link>
              </h1>
            </div>

            <div className="header-dawn__icons">
              <button
                type="button"
                className="header-dawn__icon-btn header-dawn__hide-tiny"
                aria-label={t("nav.searchAria")}
                onClick={() => setSearchOpen(true)}
              >
                <IconSearch className="header-dawn__icon" />
              </button>
              <Link
                to="/pages/contact"
                className="header-dawn__icon-btn header-dawn__icon-link header-dawn__hide-tiny"
                aria-label={t("nav.contact")}
              >
                <IconAccount className="header-dawn__icon" />
              </Link>
              <button
                type="button"
                className="header-dawn__icon-btn header-dawn__cart-btn"
                onClick={() => setOpen(true)}
                aria-label={`${t("cart.drawerTitle")}, ${count}`}
              >
                <span className="header-dawn__cart-wrap">
                  <IconCart className="header-dawn__icon header-dawn__icon--cart" />
                  {count > 0 && (
                    <span className="header-dawn__cart-count">{count}</span>
                  )}
                </span>
              </button>
            </div>
          </div>

          <nav
            className="header-dawn__row2 header-dawn__desktop-nav"
            aria-label={t("nav.mainNav")}
          >
            <ul className="header-dawn__list-menu" role="list">
              <li className="header-dawn__lang-item">
                <label className="visually-hidden" htmlFor="header-lang">
                  {t("lang.picker")}
                </label>
                <select
                  id="header-lang"
                  className="header-dawn__lang-select"
                  value={i18n.language}
                  onChange={(e) => void i18n.changeLanguage(e.target.value)}
                >
                  {SUPPORTED_LANGS.map((code) => (
                    <option key={code} value={code}>
                      {t(`lang.${code}`)}
                    </option>
                  ))}
                </select>
              </li>
              <li>
                <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
                  {t("nav.home")}
                </NavLink>
              </li>
              <li className="header-dawn__has-dropdown">
                <div className="header-dawn__shop-pair">
                  <NavLink
                    to="/shop"
                    className={({ isActive }) => navClass(isActive)}
                  >
                    {t("nav.shop")}
                  </NavLink>
                  <details
                    ref={shopDetailsRef}
                    className="header-dawn__details header-dawn__details--nested"
                  >
                    <summary
                      className="header-dawn__summary header-dawn__summary--caret-only"
                      aria-label={`${t("nav.shop")} — ${t("nav.shopSubmenuAria")}`}
                    >
                      <IconCaret className="header-dawn__caret" />
                    </summary>
                    <ul
                      className="header-dawn__submenu header-dawn__submenu--mega"
                      role="list"
                    >
                      <li>
                        <Link
                          to={`/shop${productGridHash()}`}
                          className="header-dawn__submenu-link"
                          onClick={closeShopDropdown}
                        >
                          {t("nav.allProducts")}
                        </Link>
                      </li>
                      {shopItems.map((item) => (
                        <li key={item.slug}>
                          <Link
                            to={`/collections/${item.slug}${productGridHash()}`}
                            className="header-dawn__submenu-link"
                            onClick={closeShopDropdown}
                          >
                            {t(`categories.${item.slug}`, {
                              defaultValue: item.label,
                            })}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </li>
              <li>
                <NavLink
                  to="/pages/contact"
                  className={({ isActive }) => navClass(isActive)}
                >
                  {t("nav.contact")}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/pages/about"
                  className={({ isActive }) => navClass(isActive)}
                >
                  {t("nav.about")}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/blogs/news"
                  className={({ isActive }) => navClass(isActive)}
                >
                  {t("nav.blog")}
                </NavLink>
              </li>
            </ul>
          </nav>
        </header>
      </div>

      <div
        className={`header-dawn__drawer-backdrop ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className={`header-dawn__drawer ${drawerOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.drawerTitle")}
      >
        <div className="header-dawn__drawer-head">
          <span className="header-dawn__drawer-title">{t("nav.drawerTitle")}</span>
          <button
            type="button"
            className="header-dawn__icon-btn"
            aria-label={t("nav.closeMenuAria")}
            onClick={() => setDrawerOpen(false)}
          >
            <IconClose className="header-dawn__icon" />
          </button>
        </div>
        <nav className="header-dawn__drawer-nav">
          <ul role="list">
            <li className="header-dawn__drawer-lang">
              <label className="header-dawn__drawer-lang-label" htmlFor="drawer-lang">
                {t("lang.picker")}
              </label>
              <select
                id="drawer-lang"
                className="header-dawn__lang-select header-dawn__lang-select--drawer"
                value={i18n.language}
                onChange={(e) => void i18n.changeLanguage(e.target.value)}
              >
                {SUPPORTED_LANGS.map((code) => (
                  <option key={code} value={code}>
                    {t(`lang.${code}`)}
                  </option>
                ))}
              </select>
            </li>
            <li>
              <Link to="/" onClick={() => setDrawerOpen(false)}>
                {t("nav.home")}
              </Link>
            </li>
            <li className="header-dawn__drawer-shop">
              <span className="header-dawn__drawer-label">{t("nav.shop")}</span>
              <ul role="list">
                <li>
                  <Link
                    to={`/shop${productGridHash()}`}
                    onClick={() => setDrawerOpen(false)}
                  >
                    {t("nav.allProducts")}
                  </Link>
                </li>
                {shopItems.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={`/collections/${item.slug}${productGridHash()}`}
                      onClick={() => setDrawerOpen(false)}
                    >
                      {t(`categories.${item.slug}`, {
                        defaultValue: item.label,
                      })}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            <li>
              <Link to="/pages/contact" onClick={() => setDrawerOpen(false)}>
                {t("nav.contact")}
              </Link>
            </li>
            <li>
              <Link to="/pages/about" onClick={() => setDrawerOpen(false)}>
                {t("nav.about")}
              </Link>
            </li>
            <li>
              <Link to="/blogs/news" onClick={() => setDrawerOpen(false)}>
                {t("nav.blog")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div
        className={`header-dawn__search-backdrop ${searchOpen ? "is-open" : ""}`}
        aria-hidden={!searchOpen}
        onClick={() => setSearchOpen(false)}
      />
      <div
        className={`header-dawn__search-modal ${searchOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${searchId}-title`}
      >
        <h2 id={`${searchId}-title`} className="visually-hidden">
          {t("nav.searchAria")}
        </h2>
        <form className="header-dawn__search-form" onSubmit={submitSearch}>
          <label htmlFor={searchId} className="visually-hidden">
            {t("nav.searchPlaceholder")}
          </label>
          <input
            id={searchId}
            className="header-dawn__search-input"
            type="search"
            name="q"
            placeholder={t("nav.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoFocus={searchOpen}
          />
          <button type="submit" className="header-dawn__search-submit">
            <IconSearch className="header-dawn__icon" />
          </button>
        </form>
        <button
          type="button"
          className="header-dawn__search-close"
          aria-label={t("nav.closeSearchAria")}
          onClick={() => setSearchOpen(false)}
        >
          <IconClose className="header-dawn__icon" />
        </button>
      </div>
    </>
  );
}
