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
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import css from "./style.css";
import type { Theme } from "./types";

const STYLE_ID = "rh-styles";

/**
 * Inject the default stylesheet once per document. No-op on SSR or if already injected.
 * @internal
 */
export function injectStyles(): void {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
}

const THEME_VARS: Record<keyof Theme, string | null> = {
    accent: "--rh-accent",
    accentText: "--rh-accent-text",
    background: "--rh-bg",
    text: "--rh-text",
    mutedText: "--rh-muted",
    overlay: "--rh-overlay",
    radius: "--rh-radius",
    shadow: "--rh-shadow",
    fontFamily: "--rh-font",
    zIndex: "--rh-z",
    darkMode: null,
};

/**
 * Apply theme values as inline CSS variables on the root element and set the
 * dark-mode data attribute the stylesheet keys off of.
 * @internal
 */
export function applyTheme(root: HTMLElement, theme: Theme | undefined): void {
    const dark = theme?.darkMode;
    root.setAttribute("data-rh-dark", dark === "auto" ? "auto" : dark === true ? "true" : "false");
    if (!theme) return;
    (Object.keys(theme) as (keyof Theme)[]).forEach((key) => {
        const cssVar = THEME_VARS[key];
        const value = theme[key];
        if (cssVar && value != null) {
            root.style.setProperty(cssVar, String(value));
        }
    });
}
