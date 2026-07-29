/**
 * Release Highlighter - DOM utilities
 *
 * @file DOM helpers for visibility checks, target resolution, and viewport size.
 * @license MIT
 *
 * Simple release-journey / product-tour plugin for the web. JSON-manifest driven.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.2
 * @copyright (c) 2026 Gobinda Nandi
 */

/**
 * True when the element exists in the DOM and is actually rendered, i.e. it is
 * not hidden via display/visibility/opacity and it has a layout box. This does
 * NOT consider the viewport, so an element scrolled out of view still counts as
 * present (the tour scrolls each step into view before showing it).
 *
 * @param element Candidate element (or null)
 * @returns True when `element` is a rendered HTMLElement
 */
export function isElementRendered(element: Element | null): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);

    // Check if the element is hidden via display/visibility/opacity
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) {
        return false;
    }

    // Check if the element has no layout box
    if (element.offsetWidth === 0 && element.offsetHeight === 0 && element.getClientRects().length === 0) {
        return false;
    }
    return true;
}

/**
 * Resolve a CSS selector to a single element.
 * When `requireRendered` is set the first rendered match wins, otherwise the
 * first match. Only one element per target is ever used.
 *
 * @param target CSS selector
 * @param requireRendered When true, accept only currently rendered elements
 * @returns The chosen HTMLElement, or null if no suitable element is found
 */
export function pickTarget(target: string, requireRendered: boolean): HTMLElement | null {
    const nodes = Array.from(document.querySelectorAll(target));
    for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (!requireRendered || isElementRendered(node)) return node;
    }
    return null;
}

/**
 * Read current viewport width and height in CSS pixels.
 *
 * @returns Object with `width` and `height` values
 */
export function viewportSize(): { width: number; height: number } {
    return {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight,
    };
}
