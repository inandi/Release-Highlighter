import type {
    JourneyApi,
    Labels,
    Placement,
    Step,
    StorageAdapter,
    ReleaseHighlighterOptions,
} from "./types";
import { resolveStorage } from "./storage";
import { injectStyles } from "./styles";
import { isElementRendered, pickTarget } from "./dom";
import { Ui } from "./ui";
import { loadJson } from "./loaders";

const DEFAULT_LABELS: Labels = { next: "Next", prev: "Back", skip: "Skip", done: "Done" };

interface ResolvedConfig {
    labels: Labels;
    storage: StorageAdapter;
    storageKey: string;
    seenValue: string | null;
    force: boolean;
    placement: Placement;
    padding: number;
    scrollIntoView: boolean;
    autoAdvanceOnHidden: boolean;
    closeOnOverlayClick: boolean;
    keyboard: boolean;
    skipHiddenTargets: boolean;
    injectStyles: boolean;
}

interface ActiveStep {
    step: Step;
    element: HTMLElement;
}

export class ReleaseHighlighter {
    private readonly options: ReleaseHighlighterOptions;
    private readonly config: ResolvedConfig;
    private steps: Step[];
    private active: ActiveStep[] = [];
    private currentIndex = 0;
    private ui: Ui | null = null;
    private running = false;
    private boundReposition: (() => void) | null = null;
    private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
    private repositionFrame = 0;

    constructor(options: ReleaseHighlighterOptions) {
        this.options = options;
        this.steps = options.steps ? [...options.steps] : [];
        const cookieDays = options.cookieDays ?? 180;
        this.config = {
            labels: { ...DEFAULT_LABELS, ...options.labels },
            storage: resolveStorage(options.storage, cookieDays),
            storageKey: options.storageKey ?? "release_highlighter",
            seenValue: options.version ?? options.id ?? null,
            force: options.force ?? false,
            placement: options.placement ?? "auto",
            padding: options.padding ?? 8,
            scrollIntoView: options.scrollIntoView ?? true,
            autoAdvanceOnHidden: options.autoAdvanceOnHidden ?? true,
            closeOnOverlayClick: options.closeOnOverlayClick ?? true,
            keyboard: options.keyboard ?? true,
            skipHiddenTargets: options.skipHiddenTargets ?? true,
            injectStyles: options.injectStyles ?? true,
        };
    }

    /** Load steps from a remote JSON manifest, then construct an instance. */
    static async fromJson(
        url: string,
        options: Omit<ReleaseHighlighterOptions, "steps"> = {},
    ): Promise<ReleaseHighlighter> {
        const { version, steps, expires } = await loadJson(url);
        return new ReleaseHighlighter({
            ...options,
            version: options.version ?? version,
            expiresAt: options.expiresAt ?? expires,
            steps,
        });
    }

    private buildApi(): JourneyApi {
        const self = this;
        return {
            next: () => self.next(),
            prev: () => self.prev(),
            goTo: (i) => self.goTo(i),
            skip: () => self.skip(),
            finish: () => self.finish(),
            get index() {
                return self.currentIndex;
            },
            get total() {
                return self.active.length;
            },
        };
    }

    async start(): Promise<void> {
        if (this.running) return;
        try {
            if (this.config.injectStyles) injectStyles();
            if (this.isExpired()) return;
            if (this.hasSeen()) return;

            this.collectSteps();
            if (this.active.length === 0) {
                this.markSeen();
                return;
            }

            this.running = true;
            const api = this.buildApi();
            this.ui = new Ui(this.options.theme, {
                onNext: () => this.next(),
                onPrev: () => this.prev(),
                onSkip: () => this.skip(),
                onOverlayClick: () => {
                    if (this.config.closeOnOverlayClick) this.next();
                },
            });
            this.ui.mount();
            this.bindGlobalListeners();
            this.options.on?.start?.(api);
            this.showStep(0);
        } catch (err) {
            // Never break the host page.
            // eslint-disable-next-line no-console
            console.warn("ReleaseHighlighter:", err);
        }
    }

    /** True when a valid expiry is set and the current time is at/after it. */
    private isExpired(): boolean {
        const raw = this.options.expiresAt;
        if (raw == null) return false;
        const ts = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
        if (Number.isNaN(ts)) return false;
        return Date.now() >= ts;
    }

    private hasSeen(): boolean {
        if (this.config.force || !this.config.seenValue) return false;
        return this.config.storage.get(this.config.storageKey) === this.config.seenValue;
    }

    private markSeen(): void {
        if (this.config.seenValue) {
            this.config.storage.set(this.config.storageKey, this.config.seenValue);
        }
    }

    private collectSteps(): void {
        const active: ActiveStep[] = [];
        for (const step of this.steps) {
            if (step.when && !step.when()) continue;
            // Presence-based (not viewport-based) so the step count is stable
            // regardless of where the user has scrolled. Only the first matching
            // element per target is used.
            const element = pickTarget(step.target, this.config.skipHiddenTargets);
            if (!element) continue;
            active.push({ step, element });
        }
        this.active = active;
    }

    private showStep(index: number): void {
        if (!this.ui || this.active.length === 0) return;
        this.currentIndex = Math.max(0, Math.min(index, this.active.length - 1));
        const { step, element } = this.active[this.currentIndex];
        const api = this.buildApi();

        step.beforeShow?.(step, api);
        if ((step.scrollIntoView ?? this.config.scrollIntoView) && typeof element.scrollIntoView === "function") {
            element.scrollIntoView({ block: "center", inline: "nearest" });
        }

        this.renderCurrent();

        this.options.on?.step?.(step, api);
        step.afterShow?.(step, api);
    }

    /** Re-render/position the current step without scrolling or firing hooks. */
    private renderCurrent(): void {
        if (!this.ui || this.active.length === 0) return;
        const { step, element } = this.active[this.currentIndex];
        this.ui.render({
            step,
            element,
            index: this.currentIndex,
            total: this.active.length,
            api: this.buildApi(),
            labels: { ...this.config.labels, ...step.labels },
            placement: step.placement ?? this.config.placement,
            padding: step.padding ?? this.config.padding,
            closeOnOverlayClick: this.config.closeOnOverlayClick,
        });
    }

    next(): void {
        if (!this.running) return;
        const api = this.buildApi();
        const current = this.active[this.currentIndex];
        this.options.on?.next?.(current.step, api);
        if (this.currentIndex < this.active.length - 1) {
            this.showStep(this.currentIndex + 1);
        } else {
            this.finish();
        }
    }

    prev(): void {
        if (!this.running || this.currentIndex === 0) return;
        const api = this.buildApi();
        this.options.on?.prev?.(this.active[this.currentIndex].step, api);
        this.showStep(this.currentIndex - 1);
    }

    goTo(index: number): void {
        if (!this.running) return;
        this.showStep(index);
    }

    skip(): void {
        if (!this.running) return;
        this.options.on?.skip?.(this.buildApi());
        this.end(true);
    }

    finish(): void {
        if (!this.running) return;
        this.options.on?.finish?.(this.buildApi());
        this.end(true);
    }

    /** Tear down the UI without marking the journey as seen. */
    destroy(): void {
        this.end(false);
    }

    private end(markSeen: boolean): void {
        if (markSeen) this.markSeen();
        this.unbindGlobalListeners();
        this.ui?.destroy();
        this.ui = null;
        this.running = false;
    }

    private bindGlobalListeners(): void {
        // Coalesce rapid scroll/resize events into one reposition per frame.
        this.boundReposition = () => {
            if (this.repositionFrame) return;
            this.repositionFrame = requestAnimationFrame(() => {
                this.repositionFrame = 0;
                this.reposition();
            });
        };
        window.addEventListener("resize", this.boundReposition);
        window.addEventListener("scroll", this.boundReposition, true);

        if (this.config.keyboard) {
            this.boundKeydown = (e: KeyboardEvent) => {
                if (e.key === "Escape") this.skip();
                else if (e.key === "Enter" || e.key === "ArrowRight") {
                    if (isEditableTarget(e.target)) return;
                    this.next();
                } else if (e.key === "ArrowLeft") {
                    if (isEditableTarget(e.target)) return;
                    this.prev();
                }
            };
            document.addEventListener("keydown", this.boundKeydown);
        }
    }

    private unbindGlobalListeners(): void {
        if (this.repositionFrame) {
            cancelAnimationFrame(this.repositionFrame);
            this.repositionFrame = 0;
        }
        if (this.boundReposition) {
            window.removeEventListener("resize", this.boundReposition);
            window.removeEventListener("scroll", this.boundReposition, true);
            this.boundReposition = null;
        }
        if (this.boundKeydown) {
            document.removeEventListener("keydown", this.boundKeydown);
            this.boundKeydown = null;
        }
    }

    private reposition(): void {
        if (!this.running || this.active.length === 0) return;
        const { element } = this.active[this.currentIndex];
        if (this.config.autoAdvanceOnHidden && !isElementRendered(element)) {
            this.next();
            return;
        }
        this.renderCurrent();
    }
}

/** True when focus is in a text field or contenteditable, so tour keyboard
 * shortcuts should not hijack typing. */
function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
