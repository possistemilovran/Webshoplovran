import type { CSSProperties } from "react";
import type { SiteSettings } from "@/config/siteDefaults";
import { resolveFontStack } from "@/config/siteDefaults";
import { pageBackgroundGradient } from "@/lib/colorDerivatives";

/** CSS varijable kao na glavnoj stranici — za primjenu na nacrt u uredniku. */
export function siteSettingsToCssVarsStyle(s: SiteSettings): CSSProperties {
  const { colors, announcement, textColors, fonts } = s;
  const bgGrad = pageBackgroundGradient(colors.pageBackground);
  const serif = resolveFontStack(
    fonts.headingPresetId,
    fonts.headingFamilyOverride
  );
  const sans = resolveFontStack(fonts.bodyPresetId, fonts.bodyFamilyOverride);
  const headerNav = resolveFontStack(
    fonts.headerNavPresetId,
    fonts.headerNavFamilyOverride
  );

  return {
    "--color-bg": bgGrad.light,
    "--color-bg-gradient-end": bgGrad.dark,
    "--color-bg-muted": colors.pageMuted,
    "--color-ink": colors.ink,
    "--color-ink-muted": colors.inkMuted,
    "--color-accent": colors.accent,
    "--color-accent-hover": colors.accentHover,
    "--color-line": colors.line,
    "--color-announce": announcement.background,
    "--color-announce-text": announcement.color,
    "--announce-duration": `${Math.max(8, announcement.durationSec)}s`,
    "--header-bg": colors.headerBackground,
    "--header-link": colors.accent,
    "--header-ink-strong": colors.ink,
    "--header-ink": colors.inkMuted,
    "--hero-title-color": textColors.heroTitle,
    "--hero-lede-color": textColors.heroLede,
    "--eyebrow-color": textColors.eyebrow,
    "--section-heading-color": textColors.sectionHeading,
    "--font-serif": serif,
    "--font-sans": sans,
    "--font-header": headerNav,
  } as CSSProperties;
}
