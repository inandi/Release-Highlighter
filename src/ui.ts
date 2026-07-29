/**
 * Release Highlighter - UI layer
 *
 * @file Rendering and positioning for overlay, highlight, tooltip, and arrow.
 * @license MIT
 *
 * Simple, highly customizable release-journey / product-tour plugin for the web.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import type { JourneyApi, Labels, Placement, Step, Theme } from "./types";
import { applyTheme } from "./styles";
import { viewportSize } from "./dom";

export interface UiHandlers {
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onOverlayClick: () => void;
}

export interface RenderContext {
    step: Step;
    element: HTMLElement;
    index: number;
    total: number;
    api: JourneyApi;
    labels: Labels;
    placement: Placement;
    padding: number;
    closeOnOverlayClick: boolean;
}

const SAFE_MARGIN = 20;

/**
 * UI layer responsible for rendering and positioning the overlay, highlight,
 * tooltip, and arrow. It does not manage step flow logic; that is handled by core.
 *
 * @internal
 */
export class Ui {
    private root: HTMLDivElement;
    private overlay: HTMLDivElement;
    private highlight: HTMLDivElement;
    private tooltip: HTMLDivElement;
    private arrow: HTMLDivElement;
    private handlers: UiHandlers;
    private readonly classPrefix: string | null;

    /**
     * Create a UI instance.
     *
     * @param theme Theme overrides applied to the injected root
     * @param classPrefix Optional additional CSS class prefix (e.g. "release-highlighter--")
     * @param handlers Callbacks for user interactions
     * @internal
     */
    constructor(theme: Theme | undefined, classPrefix: string | undefined, handlers: UiHandlers) {
        this.handlers = handlers;
        this.classPrefix = classPrefix && classPrefix.trim().length > 0 ? classPrefix : null;
        this.root = el("div", classes("rh-root", pref(this.classPrefix, "root")));
        applyTheme(this.root, theme);

        this.overlay = el("div", classes("rh-overlay", pref(this.classPrefix, "overlay")));
        this.overlay.setAttribute("role", "dialog");
        this.overlay.setAttribute("aria-modal", "true");
        this.overlay.addEventListener("click", (e) => {
            if (e.target === this.overlay) this.handlers.onOverlayClick();
        });

        this.highlight = el("div", classes("rh-highlight", pref(this.classPrefix, "highlight")));
        this.tooltip = el("div", classes("rh-tooltip", pref(this.classPrefix, "tooltip")));
        this.arrow = el("div", classes("rh-arrow", pref(this.classPrefix, "arrow")));

        this.root.append(this.overlay, this.highlight, this.tooltip, this.arrow);
    }

    /**
     * Inject the UI root into the document.
     * @internal
     */
    mount(): void {
        document.body.appendChild(this.root);
    }

    /**
     * Remove the UI root from the document.
     * @internal
     */
    destroy(): void {
        this.root.parentElement?.removeChild(this.root);
    }

    /**
     * Render tooltip content and position all UI elements for the given context.
     *
     * @param ctx Context describing the current step and target geometry
     * @internal
     */
    render(ctx: RenderContext): void {
        this.overlay.style.pointerEvents = ctx.closeOnOverlayClick ? "auto" : "none";
        this.renderContent(ctx);
        this.position(ctx);
    }

    /**
     * Populate the tooltip DOM from the `Step` definition.
     *
     * @param ctx Render context providing content and labels
     * @internal
     */
    private renderContent(ctx: RenderContext): void {
        const { step, labels } = ctx;
        this.tooltip.textContent = "";

        if (step.title) {
            const header = el("div", classes("rh-header", pref(this.classPrefix, "header")));
            setContent(header, step.title, step.html);
            this.tooltip.appendChild(header);
        }
        if (step.body) {
            const body = el("div", classes("rh-body", pref(this.classPrefix, "body")));
            setContent(body, step.body, step.html);
            this.tooltip.appendChild(body);
        }

        const controls = el("div", classes("rh-controls", pref(this.classPrefix, "controls")));
        const stepText = el("div", classes("rh-step", pref(this.classPrefix, "step")));
        stepText.textContent = `${ctx.index + 1} / ${ctx.total}`;
        controls.appendChild(stepText);

        if (ctx.index > 0) {
            controls.appendChild(this.button(labels.prev, classes("rh-btn-ghost", pref(this.classPrefix, "btn-ghost")), this.handlers.onPrev));
        }
        controls.appendChild(this.button(labels.skip, classes("rh-btn-ghost", pref(this.classPrefix, "btn-ghost")), this.handlers.onSkip));
        const isLast = ctx.index === ctx.total - 1;
        controls.appendChild(
            this.button(
                isLast ? labels.done : labels.next,
                classes("rh-btn-primary", pref(this.classPrefix, "btn-primary")),
                this.handlers.onNext,
            ),
        );

        this.tooltip.appendChild(controls);
    }

    /**
     * Compute and apply positions for highlight, tooltip, and arrow while
     * constraining them to the viewport with a 20px safe margin.
     *
     * @param ctx Render context providing target rect and dimensions
     * @remarks Tooltip width is also constrained by viewport minus the safe margin.
     * @internal
     */
    private position(ctx: RenderContext): void {
        const rect = ctx.element.getBoundingClientRect();
        const pad = ctx.padding;

        Object.assign(this.highlight.style, {
            left: `${Math.round(rect.left - pad)}px`,
            top: `${Math.round(rect.top - pad)}px`,
            width: `${Math.round(rect.width + pad * 2)}px`,
            height: `${Math.round(rect.height + pad * 2)}px`,
        });

        const { width: vw, height: vh } = viewportSize();
        const tooltipWidth = Math.max(200, Math.min(360, vw - SAFE_MARGIN * 2));
        this.tooltip.style.width = `${tooltipWidth}px`;
        const tooltipHeight = this.tooltip.offsetHeight || 120;

        const side = resolvePlacement(ctx.placement, rect, tooltipWidth, tooltipHeight, vw, vh);

        let top: number;
        let left: number;
        if (side === "top" || side === "bottom") {
            top = side === "bottom" ? rect.bottom + 12 : rect.top - tooltipHeight - 12;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
        } else {
            left = side === "right" ? rect.right + 12 : rect.left - tooltipWidth - 12;
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
        }
        top = clamp(top, SAFE_MARGIN, vh - tooltipHeight - SAFE_MARGIN);
        left = clamp(left, SAFE_MARGIN, vw - tooltipWidth - SAFE_MARGIN);

        Object.assign(this.tooltip.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
        this.positionArrow(side, rect, top, left, tooltipWidth, tooltipHeight, vw, vh);
    }

    /**
     * Position the arrow pointing from the tooltip towards the target, constrained
     * to the viewport safe margin.
     *
     * @param side Resolved tooltip side
     * @param rect Target element bounding rect
     * @param tooltipTop Top position of the tooltip (px)
     * @param tooltipLeft Left position of the tooltip (px)
     * @param tooltipWidth Tooltip width (px)
     * @param tooltipHeight Tooltip height (px)
     * @param vw Viewport width (px)
     * @param vh Viewport height (px)
     * @internal
     */
    private positionArrow(
        side: Exclude<Placement, "auto">,
        rect: DOMRect,
        tooltipTop: number,
        tooltipLeft: number,
        tooltipWidth: number,
        tooltipHeight: number,
        vw: number,
        vh: number,
    ): void {
        const half = 8;
        const style = this.arrow.style;
        if (side === "top" || side === "bottom") {
            const arrowLeft = clamp(rect.left + rect.width / 2 - half, SAFE_MARGIN, vw - SAFE_MARGIN - half * 2);
            style.left = `${Math.round(arrowLeft)}px`;
            style.top = `${Math.round(side === "bottom" ? tooltipTop - 8 : tooltipTop + tooltipHeight - 2)}px`;
            style.transform = side === "bottom" ? "rotate(180deg)" : "rotate(0deg)";
        } else {
            const arrowTop = clamp(rect.top + rect.height / 2 - half, SAFE_MARGIN, vh - SAFE_MARGIN - half * 2);
            style.top = `${Math.round(arrowTop)}px`;
            style.left = `${Math.round(side === "right" ? tooltipLeft - 8 : tooltipLeft + tooltipWidth - 2)}px`;
            style.transform = side === "right" ? "rotate(90deg)" : "rotate(-90deg)";
        }
    }

    /**
     * Create a styled button for the tooltip controls, including optional
     * prefixed classes.
     *
     * @param label Button text
     * @param variantClasses Variant class names (e.g. "rh-btn-primary")
     * @param onClick Click handler
     * @returns The created HTMLButtonElement
     * @internal
     */
    private button(label: string, variantClasses: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = classes("rh-btn", pref(this.classPrefix, "btn"), variantClasses);
        btn.textContent = label;
        btn.addEventListener("click", onClick);
        return btn;
    }
}

/**
 * Resolve requested placement to an actual side based on available space.
 *
 * @param requested Desired placement or "auto"
 * @param rect Target rect
 * @param tw Tooltip width
 * @param th Tooltip height
 * @param vw Viewport width
 * @param vh Viewport height
 * @returns Final placement excluding "auto"
 * @internal
 */
function resolvePlacement(
    requested: Placement,
    rect: DOMRect,
    tw: number,
    th: number,
    vw: number,
    vh: number,
): Exclude<Placement, "auto"> {
    if (requested !== "auto") return requested;
    const space = {
        bottom: vh - rect.bottom,
        top: rect.top,
        right: vw - rect.right,
        left: rect.left,
    };
    if (space.bottom >= th + SAFE_MARGIN) return "bottom";
    if (space.top >= th + SAFE_MARGIN) return "top";
    if (space.right >= tw + SAFE_MARGIN) return "right";
    if (space.left >= tw + SAFE_MARGIN) return "left";
    return space.bottom >= space.top ? "bottom" : "top";
}

/**
 * Create an element with a given className.
 *
 * @param tag Tag name to create
 * @param className Space-separated class list
 * @returns The created div element
 * @internal
 */
function el(tag: string, className: string): HTMLDivElement {
    const node = document.createElement(tag) as HTMLDivElement;
    node.className = className;
    return node;
}

/**
 * Join class names, skipping null/undefined/empty values.
 *
 * @param names Array of possible class names
 * @returns A space-separated class string
 * @internal
 */
function classes(...names: Array<string | null | undefined>): string {
    return names.filter(Boolean).join(" ");
}

/**
 * Build a class name using a prefix; returns null when prefix is not set.
 *
 * @param prefix Base prefix (e.g. "release-highlighter--") or null
 * @param name Suffix (e.g. "tooltip")
 * @returns Concatenated class or null
 * @internal
 */
function pref(prefix: string | null, name: string): string | null {
    if (!prefix) return null;
    return `${prefix}${name}`;
}

/**
 * Set node content as HTML or text depending on the `html` flag.
 *
 * @param node Target node to write to
 * @param content Raw string content
 * @param html When true, assigns via innerHTML; otherwise textContent
 * @internal
 */
function setContent(node: HTMLElement, content: string, html?: boolean): void {
    if (html) node.innerHTML = content;
    else node.textContent = content;
}

/**
 * Clamp a number between [min, max].
 *
 * @param value Input value
 * @param min Minimum
 * @param max Maximum
 * @returns Clamped value
 * @internal
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
}

// end of file
