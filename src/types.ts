/**
 * Release Highlighter - Type definitions
 *
 * @file Public types and options.
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
 * Where a step's tooltip is placed relative to its target element.
 * `auto` picks the side with the most available space.
 */
export type Placement = "auto" | "top" | "bottom" | "left" | "right";

/**
 * CSS selector used to find the element to spotlight.
 */
export type StepTarget = string;

/**
 * Public methods exposed to hooks so integrators can drive the journey.
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

/**
 * Labels for the controls.
 */
export interface Labels {
  next: string;
  prev: string;
  skip: string;
  done: string;
}

/**
 * A single tour step as defined in the JSON manifest.
 * All fields are JSON-serializable.
 */
export interface Step {
  /** CSS selector of the element to spotlight. */
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
}

/**
 * Theme values are written to CSS custom properties on the injected root.
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
 * Pluggable persistence. Built-in: 'cookie' | 'localStorage' | 'memory'.
 */
export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export type StorageOption =
  | "cookie"
  | "localStorage"
  | "memory"
  | StorageAdapter;

/**
 * Lifecycle hooks.
 */
export interface Hooks {
  start?: (api: JourneyApi) => void;
  step?: (step: Step, api: JourneyApi) => void;
  next?: (step: Step, api: JourneyApi) => void;
  prev?: (step: Step, api: JourneyApi) => void;
  skip?: (api: JourneyApi) => void;
  finish?: (api: JourneyApi) => void;
}

/**
 * Runtime options passed to `ReleaseHighlighter.fromJson`.
 * Steps, version, and expiry come from the JSON manifest.
 */
export interface ReleaseHighlighterOptions {
  /** Global labels for controls. */
  labels?: Partial<Labels>;
  /** Theme overrides mapped to CSS variables. */
  theme?: Theme;

  /** Persistence backend.
   * @default 'cookie'
   */
  storage?: StorageOption;
  /** Storage key.
   * @default 'release_highlighter'
   */
  storageKey?: string;
  /** How long the cookie lives (only used by the cookie adapter).
   * @default 180
   */
  cookieDays?: number;
  /** Always show, ignoring stored state. Handy for dev/demos.
   * @default false
   */
  force?: boolean;

  /** Default placement when a step does not specify one.
   * @default 'auto'
   */
  placement?: Placement;
  /** Default spotlight gap (px) around targets.
   * @default 8
   */
  padding?: number;
  /** Scroll targets into view before showing.
   * @default true
   */
  scrollIntoView?: boolean;
  /** Advance automatically if the current target scrolls out of view.
   * @default true
   */
  autoAdvanceOnHidden?: boolean;
  /** Allow closing by clicking the dimmed overlay.
   * @default true
   */
  closeOnOverlayClick?: boolean;
  /** Enable arrow/enter/escape keyboard controls.
   * @default true
   */
  keyboard?: boolean;
  /** Skip steps whose target is not currently visible.
   * @default true
   */
  skipHiddenTargets?: boolean;

  /** Inject the default stylesheet. Set false to ship your own CSS.
   * @default true
   */
  injectStyles?: boolean;

  /**
   * Optional additional CSS class prefix applied to all injected UI elements
   * in addition to the built-in `rh-*` classes.
   */
  classPrefix?: string;

  /** Lifecycle hooks. */
  on?: Hooks;
}

/**
 * Internal options used after a JSON manifest has been loaded.
 * Carries `steps` plus optional persistence `version` and `expiresAt` from the manifest.
 *
 * @internal
 */
export interface InternalOptions extends ReleaseHighlighterOptions {
  /** Steps loaded from the JSON manifest. */
  steps: Step[];
  /** Journey identity from the manifest `version` field. */
  version?: string;
  /** Optional expiry from the manifest `expires` field. */
  expiresAt?: string | number | Date;
}
