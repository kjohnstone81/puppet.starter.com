import { ALLOWED_FONTS } from "./defaults";
import type { Theme } from "./types";

/**
 * Renders a theme into CSS custom properties. The whole site styles itself from
 * these variables, so swapping the theme document re-skins every page without
 * touching a stylesheet.
 */
export function themeToCss(theme: Theme): string {
  const { palette, darkPalette, typography, radius } = theme;

  const vars = (p: Theme["palette"]) =>
    [
      `--bg: ${p.background};`,
      `--surface: ${p.surface};`,
      `--fg: ${p.foreground};`,
      `--muted: ${p.muted};`,
      `--border: ${p.border};`,
      `--primary: ${p.primary};`,
      `--primary-fg: ${p.primaryForeground};`,
      `--accent: ${p.accent};`,
    ].join("\n    ");

  return `:root {
    ${vars(palette)}
    --font-heading: "${safeFont(typography.headingFont)}", system-ui, sans-serif;
    --font-body: "${safeFont(typography.bodyFont)}", system-ui, sans-serif;
    --heading-weight: ${typography.headingWeight};
    --heading-tracking: ${typography.headingLetterSpacing};
    --radius-sm: ${radius.sm};
    --radius-md: ${radius.md};
    --radius-lg: ${radius.lg};
    color-scheme: light dark;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      ${vars(darkPalette)}
    }
  }`;
}

/** Google Fonts stylesheet URL for the theme's two families. */
export function fontHref(theme: Theme): string {
  const families = Array.from(
    new Set([safeFont(theme.typography.headingFont), safeFont(theme.typography.bodyFont)]),
  );
  const params = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/**
 * The model picks from a fixed enum, but a hand-edited theme document could
 * still carry anything — clamp to the allow-list so we never emit a font
 * reference the site can't load.
 */
function safeFont(name: string): string {
  const match = ALLOWED_FONTS.find((f) => f.toLowerCase() === name?.toLowerCase());
  return match ?? "Inter";
}
