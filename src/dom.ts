import type { StepTarget } from "./types";

/**
 * True when the element exists in the DOM and is actually rendered, i.e. it is
 * not hidden via display/visibility/opacity and it has a layout box. This does
 * NOT consider the viewport, so an element scrolled out of view still counts as
 * present (the tour scrolls each step into view before showing it).
 */
export function isElementRendered(element: Element | null): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) {
        return false;
    }
    if (element.offsetWidth === 0 && element.offsetHeight === 0 && element.getClientRects().length === 0) {
        return false;
    }
    return true;
}

/**
 * Resolve a step target to a single element.
 * - String selectors match by `querySelectorAll`; when `requireRendered` is set
 *   the first rendered match wins, otherwise the first match. Only one element
 *   per target is ever used.
 * - Element / function targets are returned as-is (subject to the render check).
 */
export function pickTarget(target: StepTarget, requireRendered: boolean): HTMLElement | null {
    if (typeof target === "string") {
        const nodes = Array.from(document.querySelectorAll(target));
        for (const node of nodes) {
            if (!(node instanceof HTMLElement)) continue;
            if (!requireRendered || isElementRendered(node)) return node;
        }
        return null;
    }
    const el = typeof target === "function" ? target() : target;
    if (!(el instanceof HTMLElement)) return null;
    if (requireRendered && !isElementRendered(el)) return null;
    return el;
}

export function viewportSize(): { width: number; height: number } {
    return {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight,
    };
}
