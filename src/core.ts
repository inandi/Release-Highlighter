/**
 * Release Highlighter - Core runtime
 *
 * @file Orchestrates journeys: filters steps, manages state, wires UI, input, and persistence.
 * @license MIT
 *
 * Simple release-journey / product-tour plugin for the web. JSON-manifest driven.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.2
 * @copyright (c) 2026 Gobinda Nandi
 */

import type {
  JourneyApi,
  Labels,
  Placement,
  Step,
  StorageAdapter,
  ReleaseHighlighterOptions,
  InternalOptions,
} from "./types";
import { resolveStorage } from "./storage";
import { injectStyles } from "./styles";
import { isElementRendered, pickTarget } from "./dom";
import { Ui } from "./ui";
import { loadJson } from "./loaders";

const DEFAULT_LABELS: Labels = {
  next: "Next",
  prev: "Back",
  skip: "Skip",
  done: "Done",
};

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
  /** Stable identifier used for per-step "seen" persistence. */
  id: string;
}

/** Persisted shape: which step ids have been seen, scoped to a version. */
interface SeenState {
  v: string;
  seen: string[];
}

/**
 * Orchestrates the release journey from a JSON manifest: filters steps, manages
 * state, wires UI, handles input, and persists completion.
 *
 * @public
 * @remarks Create instances only via {@link ReleaseHighlighter.fromJson}.
 * @example
 * import { ReleaseHighlighter } from "@inandi/release-highlighter";
 * const rh = await ReleaseHighlighter.fromJson("/releases/2.1.0.json");
 * await rh.start();
 */
export class ReleaseHighlighter {
  private readonly options: InternalOptions;
  private readonly config: ResolvedConfig;
  private steps: Step[];
  private active: ActiveStep[] = [];
  private currentIndex = 0;
  private ui: Ui | null = null;
  private running = false;
  private boundReposition: (() => void) | null = null;
  private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
  private repositionFrame = 0;

  /**
   * Create an instance from already-loaded manifest data.
   *
   * @param options Internal options including `steps`, optional `version`, and optional `expiresAt`
   * @internal Prefer {@link ReleaseHighlighter.fromJson}.
   */
  private constructor(options: InternalOptions) {
    this.options = options;
    this.steps = [...options.steps];
    const cookieDays = options.cookieDays ?? 180;
    this.config = {
      labels: { ...DEFAULT_LABELS, ...options.labels },
      storage: resolveStorage(options.storage, cookieDays),
      storageKey: options.storageKey ?? "release_highlighter",
      seenValue: options.version ?? null,
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

  /**
   * Load a JSON manifest and create an instance.
   *
   * @param url URL to a JSON manifest (`{ version, steps, expires? }`)
   * @param options Optional runtime overrides (theme, force, storage, …)
   * @returns A configured ReleaseHighlighter instance
   * @public
   */
  static async fromJson(
    url: string,
    options: ReleaseHighlighterOptions = {},
  ): Promise<ReleaseHighlighter> {
    const { version, steps, expires } = await loadJson(url);
    return new ReleaseHighlighter({
      ...options,
      version,
      expiresAt: expires,
      steps,
    });
  }

  /**
   * Build a stable API object exposed to lifecycle hooks.
   *
   * @returns Read-only API with navigation methods and counters
   * @internal
   */
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

  /**
   * Start the journey if eligible (not expired, and at least one unseen step is
   * present on the page). Injects styles, mounts UI, binds listeners, and shows
   * the first unseen step.
   *
   * @public
   * @see ReleaseHighlighterOptions
   */
  async start(): Promise<void> {
    if (this.running) return;
    try {
      if (this.config.injectStyles) injectStyles();
      if (this.isExpired()) return;

      this.collectSteps();
      if (this.active.length === 0) return;

      this.running = true;
      const api = this.buildApi();
      this.ui = new Ui(this.options.theme, this.options.classPrefix, {
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

  /** True when a valid expiry is set and the current time is at/after it.
   * @internal
   */
  private isExpired(): boolean {
    const raw = this.options.expiresAt;
    if (raw == null) return false;
    const ts = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() >= ts;
  }

  /**
   * Stable identifier for a step, used for per-step "seen" persistence. Uses
   * the resolved CSS selector target (derived from `targetClass` for manifest
   * steps), which is unique and stable across pages.
   * @internal
   */
  private stepId(step: Step): string {
    return typeof step.target === "string" ? step.target : "";
  }

  /**
   * Read the set of step ids already seen for the current version. Returns an
   * empty set when there is no version, on a version mismatch (a new release
   * resets progress), or when the stored value is missing/legacy/malformed.
   * @internal
   */
  private getSeenSet(): Set<string> {
    if (this.config.force || !this.config.seenValue) return new Set();
    const raw = this.config.storage.get(this.config.storageKey);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw) as Partial<SeenState>;
      if (
        parsed &&
        parsed.v === this.config.seenValue &&
        Array.isArray(parsed.seen)
      ) {
        return new Set(
          parsed.seen.filter((x): x is string => typeof x === "string"),
        );
      }
    } catch {
      /* legacy or malformed value: treat as nothing seen */
    }
    return new Set();
  }

  /**
   * Mark a single step id as seen for the current version and persist it.
   * No-op when forcing, when there is no version, or when the id is empty.
   * @internal
   */
  private markStepSeen(id: string): void {
    if (this.config.force || !this.config.seenValue || !id) return;
    const set = this.getSeenSet();
    if (set.has(id)) return;
    set.add(id);
    const state: SeenState = {
      v: this.config.seenValue,
      seen: Array.from(set),
    };
    this.config.storage.set(this.config.storageKey, JSON.stringify(state));
  }

  /**
   * Resolve each step's CSS selector target and build the active step list.
   * Presence-based selection keeps the step count stable regardless of scroll,
   * and steps already seen for the current version are excluded so remaining
   * targets keep showing across pages until seen (or the version/expiry ends).
   * @internal
   */
  private collectSteps(): void {
    const seen = this.getSeenSet();
    const active: ActiveStep[] = [];
    for (const step of this.steps) {
      const id = this.stepId(step);
      if (id && seen.has(id)) continue; // already shown for this version
      // Presence-based (not viewport-based) so the step count is stable
      // regardless of where the user has scrolled. Only the first matching
      // element per target is used.
      const element = pickTarget(step.target, this.config.skipHiddenTargets);
      if (!element) continue;
      active.push({ step, element, id });
    }
    this.active = active;
  }

  /**
   * Render the step at `index`, scrolling the target into view when enabled.
   *
   * @param index Zero-based index within the active step list
   * @internal
   */
  private showStep(index: number): void {
    if (!this.ui || this.active.length === 0) return;
    this.currentIndex = Math.max(0, Math.min(index, this.active.length - 1));
    const { step, element, id } = this.active[this.currentIndex];
    const api = this.buildApi();

    if (
      (step.scrollIntoView ?? this.config.scrollIntoView) &&
      typeof element.scrollIntoView === "function"
    ) {
      element.scrollIntoView({ block: "center", inline: "nearest" });
    }

    this.renderCurrent();
    // Persist this step as seen the moment it is displayed, so it will not
    // reappear on other pages within the same version.
    this.markStepSeen(id);
    this.options.on?.step?.(step, api);
  }

  /** Re-render/position the current step without scrolling or firing hooks.
   * @internal
   */
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

  /**
   * Advance to the next step or finish the journey when at the end.
   * @public
   */
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

  /**
   * Go back to the previous step when not on the first one.
   * @public
   */
  prev(): void {
    if (!this.running || this.currentIndex === 0) return;
    const api = this.buildApi();
    this.options.on?.prev?.(this.active[this.currentIndex].step, api);
    this.showStep(this.currentIndex - 1);
  }

  /**
   * Jump to an arbitrary step index.
   *
   * @param index Desired step index
   * @public
   */
  goTo(index: number): void {
    if (!this.running) return;
    this.showStep(index);
  }

  /**
   * Skip the journey, calling the `skip` hook and tearing down the UI. Steps
   * are persisted individually as they are shown, so skipping does not hide
   * steps that were never displayed.
   * @public
   */
  skip(): void {
    if (!this.running) return;
    this.options.on?.skip?.(this.buildApi());
    this.end();
  }

  /**
   * Finish the journey, calling the `finish` hook and tearing down the UI.
   * @public
   */
  finish(): void {
    if (!this.running) return;
    this.options.on?.finish?.(this.buildApi());
    this.end();
  }

  /** Tear down the UI.
   * @public
   */
  destroy(): void {
    this.end();
  }

  /**
   * Shared teardown: unbind listeners and destroy the UI. Leaves the instance
   * reusable. Per-step "seen" state is persisted at display time, not here.
   * @internal
   */
  private end(): void {
    this.unbindGlobalListeners();
    this.ui?.destroy();
    this.ui = null;
    this.running = false;
  }

  /**
   * Bind resize/scroll for repositioning and global keyboard handlers when
   * enabled. Coalesces rapid events via requestAnimationFrame.
   *
   * @remarks Repositioning is coalesced per frame for performance.
   * @internal
   */
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

  /**
   * Remove previously bound global listeners and any scheduled frame.
   * @internal
   */
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

  /**
   * Reposition the current step or auto-advance if the target is no longer
   * rendered and auto-advance is enabled.
   * @internal
   */
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

/**
 * True when focus is in a text field or contenteditable, so tour keyboard
 * shortcuts should not hijack typing.
 *
 * @param target Event target to test
 * @returns Whether the target is an editable element
 * @internal
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
