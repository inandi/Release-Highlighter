/**
 * Where a step's tooltip is placed relative to its target element.
 * `auto` picks the side with the most available space.
 */
export type Placement = "auto" | "top" | "bottom" | "left" | "right";

/**
 * A target can be a CSS selector, a live element, or a resolver function.
 * Functions are evaluated at the moment the step is shown, which is useful for
 * elements that are rendered lazily.
 */
export type StepTarget = string | Element | (() => Element | null | undefined);

/**
 * Public methods exposed to hooks and custom renderers so integrators can drive
 * the journey from their own UI.
 */
export interface JourneyApi {
    next(): void;
    prev(): void;
    goTo(index: number): void;
    skip(): void;
    finish(): void;
    readonly index: number;
    readonly total: number;
}

export interface Labels {
    next: string;
    prev: string;
    skip: string;
    done: string;
}

export interface Step {
    /** Element(s) to spotlight. */
    target: StepTarget;
    /** Optional bold heading shown above the body. */
    title?: string;
    /** Body content. Plain text unless `html` is true. */
    body?: string;
    /** Treat `title`/`body` as trusted HTML instead of plain text. */
    html?: boolean;
    /** Override tooltip placement for this step. */
    placement?: Placement;
    /** Spotlight gap (px) around the target for this step. */
    padding?: number;
    /** Per-step label overrides (merged over global labels). */
    labels?: Partial<Labels>;
    /** Scroll the target into view before showing. Defaults to the global option. */
    scrollIntoView?: boolean;
    /** Skip this step when it returns false. */
    when?: () => boolean;
    /** Called right before the step is rendered. */
    beforeShow?: (step: Step, api: JourneyApi) => void;
    /** Called right after the step is rendered. */
    afterShow?: (step: Step, api: JourneyApi) => void;
    /**
     * Fully custom tooltip content. Return a string (HTML) or a DOM node; it
     * replaces the default title/body/controls markup.
     */
    render?: (step: Step, api: JourneyApi) => string | HTMLElement;
    /** Arbitrary user data carried along with the step. */
    data?: Record<string, unknown>;
}

/**
 * Theme values are written to CSS custom properties on the injected root, so any
 * of them can also be overridden from the host stylesheet.
 */
export interface Theme {
    accent?: string;
    accentText?: string;
    background?: string;
    text?: string;
    mutedText?: string;
    overlay?: string;
    radius?: string;
    shadow?: string;
    fontFamily?: string;
    zIndex?: number;
    /** `auto` follows prefers-color-scheme; true/false force the mode. */
    darkMode?: "auto" | boolean;
}

/**
 * Pluggable persistence. Return the stored value for `get`; persist for `set`.
 * Built-in adapters: 'cookie' | 'localStorage' | 'memory'.
 */
export interface StorageAdapter {
    get(key: string): string | null;
    set(key: string, value: string): void;
}

export type StorageOption = "cookie" | "localStorage" | "memory" | StorageAdapter;

export interface Hooks {
    start?: (api: JourneyApi) => void;
    step?: (step: Step, api: JourneyApi) => void;
    next?: (step: Step, api: JourneyApi) => void;
    prev?: (step: Step, api: JourneyApi) => void;
    skip?: (api: JourneyApi) => void;
    finish?: (api: JourneyApi) => void;
}

export interface ReleaseHighlighterOptions {
    /** Steps to run. Optional when loading from a remote source. */
    steps?: Step[];
    /**
     * Journey identity used for "show once" persistence. Falls back to `id`.
     * When loading from a JSON manifest this is populated from the manifest version.
     */
    version?: string;
    /** Alternative persistence key when there is no version. */
    id?: string;

    /** Global labels for controls. */
    labels?: Partial<Labels>;
    /** Theme overrides mapped to CSS variables. */
    theme?: Theme;

    /** Persistence backend. Defaults to 'cookie'. */
    storage?: StorageOption;
    /** Storage key. Defaults to 'release_highlighter'. */
    storageKey?: string;
    /** How long the cookie lives (only used by the cookie adapter). */
    cookieDays?: number;
    /** Always show, ignoring stored state. Handy for dev/demos. */
    force?: boolean;
    /**
     * Do not show on or after this moment. Accepts a UTC/ISO date string
     * (e.g. "2026-12-31T23:59:59Z"), an epoch-millis number, or a Date.
     */
    expiresAt?: string | number | Date;

    /** Default placement when a step does not specify one. */
    placement?: Placement;
    /** Default spotlight gap (px) around targets. */
    padding?: number;
    /** Scroll targets into view before showing. Defaults to true. */
    scrollIntoView?: boolean;
    /** Advance automatically if the current target scrolls out of view. */
    autoAdvanceOnHidden?: boolean;
    /** Allow closing by clicking the dimmed overlay. Defaults to true. */
    closeOnOverlayClick?: boolean;
    /** Enable arrow/enter/escape keyboard controls. Defaults to true. */
    keyboard?: boolean;
    /** Skip steps whose target is not currently visible. Defaults to true. */
    skipHiddenTargets?: boolean;

    /** Inject the default stylesheet. Set false to ship your own CSS. */
    injectStyles?: boolean;

    /** Lifecycle hooks. */
    on?: Hooks;
}
