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

export class Ui {
    private root: HTMLDivElement;
    private overlay: HTMLDivElement;
    private highlight: HTMLDivElement;
    private tooltip: HTMLDivElement;
    private arrow: HTMLDivElement;
    private handlers: UiHandlers;

    constructor(theme: Theme | undefined, handlers: UiHandlers) {
        this.handlers = handlers;
        this.root = el("div", "rh-root");
        applyTheme(this.root, theme);

        this.overlay = el("div", "rh-overlay");
        this.overlay.setAttribute("role", "dialog");
        this.overlay.setAttribute("aria-modal", "true");
        this.overlay.addEventListener("click", (e) => {
            if (e.target === this.overlay) this.handlers.onOverlayClick();
        });

        this.highlight = el("div", "rh-highlight");
        this.tooltip = el("div", "rh-tooltip");
        this.arrow = el("div", "rh-arrow");

        this.root.append(this.overlay, this.highlight, this.tooltip, this.arrow);
    }

    mount(): void {
        document.body.appendChild(this.root);
    }

    destroy(): void {
        this.root.parentElement?.removeChild(this.root);
    }

    render(ctx: RenderContext): void {
        this.overlay.style.pointerEvents = ctx.closeOnOverlayClick ? "auto" : "none";
        this.renderContent(ctx);
        this.position(ctx);
    }

    private renderContent(ctx: RenderContext): void {
        const { step, api, labels } = ctx;
        this.tooltip.textContent = "";

        if (step.render) {
            const custom = step.render(step, api);
            if (typeof custom === "string") {
                this.tooltip.innerHTML = custom;
            } else {
                this.tooltip.appendChild(custom);
            }
            return;
        }

        if (step.title) {
            const header = el("div", "rh-header");
            setContent(header, step.title, step.html);
            this.tooltip.appendChild(header);
        }
        if (step.body) {
            const body = el("div", "rh-body");
            setContent(body, step.body, step.html);
            this.tooltip.appendChild(body);
        }

        const controls = el("div", "rh-controls");
        const stepText = el("div", "rh-step");
        stepText.textContent = `${ctx.index + 1} / ${ctx.total}`;
        controls.appendChild(stepText);

        if (ctx.index > 0) {
            controls.appendChild(button(labels.prev, "rh-btn-ghost", this.handlers.onPrev));
        }
        controls.appendChild(button(labels.skip, "rh-btn-ghost", this.handlers.onSkip));
        const isLast = ctx.index === ctx.total - 1;
        controls.appendChild(button(isLast ? labels.done : labels.next, "rh-btn-primary", this.handlers.onNext));

        this.tooltip.appendChild(controls);
    }

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
}

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

function el(tag: string, className: string): HTMLDivElement {
    const node = document.createElement(tag) as HTMLDivElement;
    node.className = className;
    return node;
}

function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `rh-btn ${variant}`;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
}

function setContent(node: HTMLElement, content: string, html?: boolean): void {
    if (html) node.innerHTML = content;
    else node.textContent = content;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, Math.max(min, max)));
}
