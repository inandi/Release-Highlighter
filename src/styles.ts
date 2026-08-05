/**
 * Release Highlighter - Styles injector and theming
 *
 * @file Style injection and theme variable application.
 * @license MIT
 *
 * Simple, highly customizable release-journey / product-tour plugin for the web.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.2
 * @copyright (c) 2026 Gobinda Nandi
 */

import css from "./style.css";
import type { Theme } from "./types";

// Unique identifier for the stylesheet
const STYLE_ID = "rh-styles";

/**
 * Inject the default stylesheet once per document. No-op on SSR or if already injected.
 * @internal
 */
export function injectStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID))
    return;

  // Create a style element and add it to the head
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;

  // Append the style element to the head
  document.head.appendChild(style);
}

// CSS variables for the theme
const THEME_VARS: Record<keyof Theme, string | null> = {
  accent: "--rh-accent", // CSS variable for the accent color
  accentText: "--rh-accent-text", // CSS variable for the accent text color
  background: "--rh-bg", // CSS variable for the background color
  text: "--rh-text", // CSS variable for the text color
  mutedText: "--rh-muted", // CSS variable for the muted text color
  overlay: "--rh-overlay", // CSS variable for the overlay color
  radius: "--rh-radius", // CSS variable for the radius
  shadow: "--rh-shadow", // CSS variable for the shadow color
  fontFamily: "--rh-font", // CSS variable for the font family
  zIndex: "--rh-z", // CSS variable for the z-index
  darkMode: null, // CSS variable for the dark mode
};

/**
 * Apply theme values as inline CSS variables on the root element and set the
 * dark-mode data attribute the stylesheet keys off of.
 * @internal
 */
export function applyTheme(root: HTMLElement, theme: Theme | undefined): void {
  const dark = theme?.darkMode;
  root.setAttribute(
    "data-rh-dark",
    dark === "auto" ? "auto" : dark === true ? "true" : "false",
  );
  if (!theme) return;
  (Object.keys(theme) as (keyof Theme)[]).forEach((key) => {
    const cssVar = THEME_VARS[key];
    const value = theme[key];
    if (cssVar && value != null) {
      root.style.setProperty(cssVar, String(value));
    }
  });
}
