export interface ReleaseItem {
    className: string;
    message: string;
}

export interface ReleaseManifest {
    version: string;
    items: ReleaseItem[];
}

export interface ReleaseHighlighterOptions {
    xmlUrl: string;
    cookieName?: string;
    cookieDays?: number;
    classPrefix?: string;
}

function getCookie(name: string): string | null {
    const nameEq = name + "=";
    const parts = document.cookie.split("; ");
    for (const part of parts) {
        if (part.startsWith(nameEq)) {
            return decodeURIComponent(part.substring(nameEq.length));
        }
    }
    return null;
}

function setCookie(name: string, value: string, days: number): void {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

function isElementVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) {
        return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
}

function injectStyles(): void {
    if (document.getElementById("rh-styles")) return;
    const style = document.createElement("style");
    style.id = "rh-styles";
    style.textContent = `
  .rh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646}
  .rh-highlight{position:fixed;box-shadow:0 0 0 3px #4f80ff,0 0 0 9999px rgba(0,0,0,0);border-radius:8px;z-index:2147483647;pointer-events:none;transition:all .2s ease}
  .rh-tooltip{position:fixed;max-width:360px;background:#fff;color:#111;border-radius:10px;box-shadow:0 12px 24px rgba(0,0,0,.2);padding:14px 16px;z-index:2147483648;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45}
  .rh-tooltip{box-sizing:border-box;overflow-wrap:anywhere}
  .rh-tooltip .rh-header{font-weight:600;margin-bottom:8px}
  .rh-tooltip .rh-controls{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}
  .rh-btn{appearance:none;border:0;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer}
  .rh-btn-primary{background:#4f80ff;color:#fff}
  .rh-btn-ghost{background:#f1f3f5;color:#111}
  .rh-step{font-size:12px;color:#666;margin-right:auto;align-self:center}
  .rh-arrow{position:fixed;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #fff;z-index:2147483648}
  `;
    document.head.appendChild(style);
}

function parseXmlManifest(xml: string): ReleaseManifest {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
        throw new Error("Invalid XML manifest");
    }
    const releaseEl = doc.querySelector("release");
    if (!releaseEl) throw new Error("Missing <release> root element");
    const version = (releaseEl.getAttribute("version") || "").trim();
    if (!version) throw new Error("<release> must include a version attribute");
    const items: ReleaseItem[] = [];
    const itemEls = Array.from(releaseEl.querySelectorAll("item"));
    for (const itemEl of itemEls) {
        const className = (itemEl.getAttribute("class") || "").trim();
        const message = (itemEl.querySelector("message")?.textContent || "").trim();
        if (!className || !message) continue;
        items.push({ className, message });
    }
    return { version, items };
}

interface Step {
    element: Element;
    message: string;
}

export class ReleaseHighlighter {
    private options: Required<ReleaseHighlighterOptions>;
    private manifest: ReleaseManifest | null = null;
    private steps: Step[] = [];
    private currentIndex = 0;
    private overlayEl: HTMLDivElement | null = null;
    private highlightEl: HTMLDivElement | null = null;
    private tooltipEl: HTMLDivElement | null = null;
    private arrowEl: HTMLDivElement | null = null;
    private boundReposition: (() => void) | null = null;
    private boundKeydown: ((e: KeyboardEvent) => void) | null = null;

    constructor(options: ReleaseHighlighterOptions) {
        this.options = {
            cookieName: "release_highlighter_version",
            cookieDays: 180,
            classPrefix: "release-highlighter--",
            ...options,
        };
    }

    async start(): Promise<void> {
        try {
            injectStyles();
            const xml = await this.fetchXml();
            this.manifest = parseXmlManifest(xml);
            if (getCookie(this.options.cookieName) === this.manifest.version) {
                return; // already seen
            }
            this.collectSteps();
            if (this.steps.length === 0) {
                // No visible steps on this page; mark as seen and exit
                setCookie(this.options.cookieName, this.manifest.version, this.options.cookieDays);
                return;
            }
            this.mountUi();
            this.showStep(0);
        } catch (err) {
            // Fail silently; do not break host page
            // eslint-disable-next-line no-console
            console.warn("ReleaseHighlighter:", err);
        }
    }

    private async fetchXml(): Promise<string> {
        const res = await fetch(this.options.xmlUrl, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`Failed to load XML: ${res.status}`);
        return await res.text();
    }

    private collectSteps(): void {
        if (!this.manifest) return;
        const steps: Step[] = [];
        const processedClasses = new Set<string>();
        for (const item of this.manifest.items) {
            // Determine effective class using configured prefix
            const prefix = this.options.classPrefix || "";
            const effectiveClass = item.className.startsWith(prefix)
                ? item.className
                : `${prefix}${item.className}`;

            // Skip duplicate class entries to ensure only one step per class
            if (processedClasses.has(effectiveClass)) continue;
            const candidates = Array.from(document.getElementsByClassName(effectiveClass));
            const target = candidates.find((el) => isElementVisible(el));
            if (target) {
                steps.push({ element: target, message: item.message });
                processedClasses.add(effectiveClass);
            }
        }
        this.steps = steps;
    }

    private mountUi(): void {
        // Overlay
        const overlay = document.createElement("div");
        overlay.className = "rh-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.addEventListener("click", (e) => {
            // Click outside tooltip moves to next
            if (e.target === overlay) {
                this.next();
            }
        });

        // Highlight box
        const highlight = document.createElement("div");
        highlight.className = "rh-highlight";

        // Tooltip
        const tooltip = document.createElement("div");
        tooltip.className = "rh-tooltip";
        const header = document.createElement("div");
        header.className = "rh-header";
        header.textContent = "What's new";
        const body = document.createElement("div");
        body.className = "rh-body";
        const controls = document.createElement("div");
        controls.className = "rh-controls";
        const stepText = document.createElement("div");
        stepText.className = "rh-step";
        const skipBtn = document.createElement("button");
        skipBtn.className = "rh-btn rh-btn-ghost";
        skipBtn.type = "button";
        skipBtn.textContent = "Skip";
        skipBtn.addEventListener("click", () => this.finish());
        const nextBtn = document.createElement("button");
        nextBtn.className = "rh-btn rh-btn-primary";
        nextBtn.type = "button";
        nextBtn.textContent = "Next";
        nextBtn.addEventListener("click", () => this.next());
        controls.appendChild(stepText);
        controls.appendChild(skipBtn);
        controls.appendChild(nextBtn);
        tooltip.appendChild(header);
        tooltip.appendChild(body);
        tooltip.appendChild(controls);

        // Arrow
        const arrow = document.createElement("div");
        arrow.className = "rh-arrow";

        document.body.appendChild(overlay);
        document.body.appendChild(highlight);
        document.body.appendChild(tooltip);
        document.body.appendChild(arrow);

        this.overlayEl = overlay;
        this.highlightEl = highlight;
        this.tooltipEl = tooltip;
        this.arrowEl = arrow;

        this.boundReposition = () => this.reposition();
        window.addEventListener("resize", this.boundReposition);
        window.addEventListener("scroll", this.boundReposition, true);

        this.boundKeydown = (e: KeyboardEvent) => {
            if (e.key === "Escape") this.finish();
            if (e.key === "Enter" || e.key === " ") this.next();
        };
        document.addEventListener("keydown", this.boundKeydown);
    }

    private showStep(index: number): void {
        if (!this.tooltipEl || !this.highlightEl || !this.overlayEl) return;
        this.currentIndex = Math.max(0, Math.min(index, this.steps.length - 1));
        const step = this.steps[this.currentIndex];
        const rect = step.element.getBoundingClientRect();

        // Highlight position
        Object.assign(this.highlightEl.style, {
            left: `${Math.round(rect.left - 8)}px`,
            top: `${Math.round(rect.top - 8)}px`,
            width: `${Math.round(rect.width + 16)}px`,
            height: `${Math.round(rect.height + 16)}px`,
            borderRadius: "8px",
        } as CSSStyleDeclaration);

        // Tooltip content
        const body = this.tooltipEl.querySelector(".rh-body") as HTMLDivElement;
        const stepText = this.tooltipEl.querySelector(".rh-step") as HTMLDivElement;
        body.textContent = step.message;
        stepText.textContent = `${this.currentIndex + 1} / ${this.steps.length}`;

        // Tooltip position with safe margins and actual height measurement
        const SAFE_MARGIN = 20;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        // Constrain width to viewport minus margins, with a reasonable minimum
        const tooltipWidth = Math.max(200, Math.min(360, viewportWidth - SAFE_MARGIN * 2));
        this.tooltipEl.style.width = `${tooltipWidth}px`;

        // Compute available space considering margins
        const spaceBelow = viewportHeight - rect.bottom - SAFE_MARGIN;
        const spaceAbove = rect.top - SAFE_MARGIN;

        // Use actual tooltip height after content & width applied
        let measuredHeight = this.tooltipEl.offsetHeight;
        const tooltipHeight = measuredHeight && isFinite(measuredHeight) ? measuredHeight : 120;

        const placeBelow = spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove;

        let top = placeBelow ? rect.bottom + 12 : rect.top - tooltipHeight - 16;
        top = Math.max(SAFE_MARGIN, Math.min(top, viewportHeight - tooltipHeight - SAFE_MARGIN));

        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        left = Math.max(SAFE_MARGIN, Math.min(left, viewportWidth - tooltipWidth - SAFE_MARGIN));

        Object.assign(this.tooltipEl.style, {
            width: `${tooltipWidth}px`,
            left: `${Math.round(left)}px`,
            top: `${Math.round(top)}px`,
        } as CSSStyleDeclaration);

        // Arrow position
        if (this.arrowEl) {
            const arrowHalf = 8;
            const arrowLeftRaw = rect.left + rect.width / 2 - arrowHalf;
            const arrowLeft = Math.max(SAFE_MARGIN, Math.min(arrowLeftRaw, viewportWidth - SAFE_MARGIN - arrowHalf * 2));
            const arrowTop = placeBelow ? rect.bottom + 2 : top + tooltipHeight;
            Object.assign(this.arrowEl.style, {
                left: `${Math.round(arrowLeft)}px`,
                top: `${Math.round(arrowTop)}px`,
                transform: placeBelow ? "rotate(0deg)" : "rotate(180deg)",
                borderTopColor: "#fff",
            } as CSSStyleDeclaration);
        }
    }

    private reposition(): void {
        if (this.steps.length === 0) return;
        const step = this.steps[this.currentIndex];
        if (!isElementVisible(step.element)) {
            // If current target is no longer visible, advance automatically
            this.next();
            return;
        }
        this.showStep(this.currentIndex);
    }

    private next(): void {
        if (this.currentIndex < this.steps.length - 1) {
            this.showStep(this.currentIndex + 1);
        } else {
            this.finish();
        }
    }

    private finish(): void {
        if (this.manifest) {
            setCookie(this.options.cookieName, this.manifest.version, this.options.cookieDays);
        }
        this.unmountUi();
    }

    private unmountUi(): void {
        const remove = (el: Element | null) => el && el.parentElement && el.parentElement.removeChild(el);
        remove(this.arrowEl);
        remove(this.tooltipEl);
        remove(this.highlightEl);
        remove(this.overlayEl);
        if (this.boundReposition) {
            window.removeEventListener("resize", this.boundReposition);
            window.removeEventListener("scroll", this.boundReposition, true);
        }
        if (this.boundKeydown) {
            document.removeEventListener("keydown", this.boundKeydown);
        }
        this.arrowEl = this.tooltipEl = this.highlightEl = this.overlayEl = null;
    }
}

// Expose default for module consumers
export default ReleaseHighlighter;


