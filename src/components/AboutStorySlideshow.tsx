import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABOUT_SLIDESHOW_COUNT,
  DEFAULT_ABOUT_SLIDESHOW_URLS,
} from "@/config/siteDefaults";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const POOL_SIZE = ABOUT_SLIDESHOW_COUNT;

/** U jednom redu uvijek točno 6 slika; koje šestorke biramo nasumično iz poola. */
const VISIBLE = 6;

function pickRandomSix(): number[] {
  const idx = Array.from({ length: POOL_SIZE }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx.slice(0, VISIBLE);
}

function sameSix(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function pickRandomSixAvoiding(prev: number[]): number[] {
  let next = pickRandomSix();
  let guard = 0;
  while (sameSix(prev, next) && guard < 24) {
    next = pickRandomSix();
    guard += 1;
  }
  return next;
}

const INTERVAL_MS = 5800;
const VARIANT_COUNT = 4;

/**
 * Jedan red od 6 slika ispod naslova „O nama”. URL-ovi dolaze iz postavki
 * stranice (`images.aboutSlideshow`, 12 slotova); zadano je `public/about-slideshow/`.
 */
export function AboutStorySlideshow() {
  const { settings } = useSiteSettings();
  const slideUrls = useMemo(() => {
    const a = settings.images.aboutSlideshow;
    if (Array.isArray(a) && a.length === POOL_SIZE) {
      return a.map((u, i) => {
        const s = typeof u === "string" ? u.trim() : "";
        return s || DEFAULT_ABOUT_SLIDESHOW_URLS[i];
      });
    }
    return [...DEFAULT_ABOUT_SLIDESHOW_URLS];
  }, [settings.images.aboutSlideshow]);

  const [order, setOrder] = useState<number[]>(() => pickRandomSix());
  const [pending, setPending] = useState<number[] | null>(null);
  const [variant, setVariant] = useState(0);
  const busyRef = useRef(false);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;

  const startTransition = useCallback(() => {
    if (busyRef.current || reducedMotion) return;
    busyRef.current = true;
    setOrder((o) => {
      const next = pickRandomSixAvoiding(o);
      setVariant(Math.floor(Math.random() * VARIANT_COUNT));
      setPending(next);
      return o;
    });
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      const id = window.setInterval(() => {
        setOrder((o) => pickRandomSixAvoiding(o));
      }, INTERVAL_MS);
      return () => window.clearInterval(id);
    }
    const id = window.setInterval(startTransition, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, startTransition]);

  const onOverlayAnimationEnd = useCallback(() => {
    if (!pending) return;
    setOrder(pending);
    setPending(null);
    busyRef.current = false;
  }, [pending]);

  const row = (indices: number[], keyPrefix: string) => (
    <div className="about-story-slideshow__row" key={keyPrefix}>
      {indices.map((imgIdx, col) => (
        <figure
          key={`${keyPrefix}-slot${col}`}
          className="about-story-slideshow__cell"
        >
          <img
            key={slideUrls[imgIdx]}
            src={slideUrls[imgIdx]}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </figure>
      ))}
    </div>
  );

  return (
    <div
      className="about-story-slideshow"
      role="region"
      aria-roledescription="carousel"
      aria-label="Fotografije iz radionice"
    >
      <div className="about-story-slideshow__stage">
        {row(order, "base")}
        {pending && !reducedMotion ? (
          <div
            className={`about-story-slideshow__row about-story-slideshow__row--overlay about-story-slideshow__row--fractal-${variant}`}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              onOverlayAnimationEnd();
            }}
          >
            {pending.map((imgIdx, col) => (
              <figure
                key={`ov-slot${col}`}
                className="about-story-slideshow__cell"
              >
                <img
                  key={slideUrls[imgIdx]}
                  src={slideUrls[imgIdx]}
                  alt=""
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </figure>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
