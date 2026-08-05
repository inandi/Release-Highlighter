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
 * @version 1.1.6
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
import { localStorageAdapter, resolveStorage } from "./storage";
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

/** Maximum number of numeric step indexes stored in one persistence shard. */
const SEEN_SHARD_SIZE = 250;

interface ResolvedConfig {
  labels: Labels;
  storage: StorageAdapter;
  fallbackStorage: StorageAdapter | null;
  fallbackDays: number | null;
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
  /** Stable position in the manifest, used for per-step persistence. */
  stepIndex: number;
}

/** Persisted shape for one shard of numeric step indexes. */
interface SeenState {
  v: string;
  seen: number[];
}

/** Journey-level metadata shared by all shards for a version. */
interface SeenMeta {
  v: string;
  /** Shared expiry timestamp for the localStorage mirror. */
  e?: number;
  /** Highest shard index written for this version (inclusive). */
  maxShard: number;
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
  private starting = false;
  private persistenceWarningShown = false;
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
    const requestedCookieDays = options.cookieDays ?? 180;
    const cookieDays = Number.isFinite(requestedCookieDays)
      ? Math.max(0, requestedCookieDays)
      : 180;
    // Session cookies (cookieDays === 0) are not mirrored to localStorage,
    // otherwise progress would outlive the browser session.
    const useCookieFallback =
      (options.storage == null || options.storage === "cookie") &&
      cookieDays > 0;
    this.config = {
      labels: { ...DEFAULT_LABELS, ...options.labels },
      storage: resolveStorage(options.storage, cookieDays),
      fallbackStorage: useCookieFallback ? localStorageAdapter() : null,
      fallbackDays: useCookieFallback ? cookieDays : null,
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
   * present on the page). Concurrent/re-entrant calls are ignored. Injects
   * styles, mounts UI, binds listeners, and shows the first unseen step.
   *
   * @public
   * @see ReleaseHighlighterOptions
   */
  async start(): Promise<void> {
    if (this.running || this.starting) return;
    this.starting = true;
    try {
      if (this.config.injectStyles) injectStyles();
      if (this.isExpired()) return;
      if (!this.config.seenValue && this.steps.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          "ReleaseHighlighter: manifest has no 'version'; seen-step progress will not persist",
        );
      }

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
      this.end();
      // Never break the host page.
      // eslint-disable-next-line no-console
      console.warn("ReleaseHighlighter:", err);
    } finally {
      this.starting = false;
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
   * Build the storage key for a shard. The version remains in the value rather
   * than the key, so a new release reuses existing cookie slots instead of
   * continuously increasing the site's cookie count.
   *
   * @param shard Zero-based shard number
   * @returns Storage key for that shard
   * @internal
   */
  private shardKey(shard: number): string {
    return `${this.config.storageKey}.seen.${shard}`;
  }

  /** Storage key for journey-level seen metadata.
   * @internal
   */
  private metaKey(): string {
    return `${this.config.storageKey}.seen.meta`;
  }

  /**
   * Remove a key from the primary adapter and the cookie fallback mirror.
   *
   * @param key Storage key to clear
   * @internal
   */
  private removeKey(key: string): void {
    this.config.storage.remove?.(key);
    this.config.fallbackStorage?.remove?.(key);
  }

  /**
   * Inspect journey metadata without applying current-version filtering beyond
   * structural validation.
   *
   * @param raw Serialized metadata
   * @returns Structured metadata status
   * @internal
   */
  private inspectMeta(raw: string | null):
    | { status: "missing" }
    | { status: "ok"; meta: SeenMeta }
    | { status: "expired"; maxShard: number }
    | { status: "foreign"; maxShard: number } {
    if (!raw || !this.config.seenValue) return { status: "missing" };
    try {
      const parsed = JSON.parse(raw) as Partial<SeenMeta>;
      if (
        !parsed ||
        typeof parsed.v !== "string" ||
        !Number.isInteger(parsed.maxShard) ||
        (parsed.maxShard as number) < 0
      ) {
        return { status: "missing" };
      }
      const maxShard = parsed.maxShard as number;
      if (parsed.v !== this.config.seenValue) {
        return { status: "foreign", maxShard };
      }
      if (
        parsed.e != null &&
        !(
          typeof parsed.e === "number" &&
          Number.isFinite(parsed.e) &&
          Date.now() < parsed.e
        )
      ) {
        return { status: "expired", maxShard };
      }
      return {
        status: "ok",
        meta: {
          v: parsed.v,
          maxShard,
          ...(typeof parsed.e === "number" ? { e: parsed.e } : {}),
        },
      };
    } catch {
      return { status: "missing" };
    }
  }

  /**
   * Read journey metadata, merging cookie + localStorage mirrors.
   *
   * @returns Current-version metadata status from primary/fallback
   * @internal
   */
  private readMetaState():
    | { status: "missing" }
    | { status: "ok"; meta: SeenMeta }
    | { status: "expired"; maxShard: number }
    | { status: "foreign"; maxShard: number } {
    const key = this.metaKey();
    const primary = this.inspectMeta(this.config.storage.get(key));
    const fallback = this.config.fallbackStorage
      ? this.inspectMeta(this.config.fallbackStorage.get(key))
      : { status: "missing" as const };

    if (primary.status === "ok" || fallback.status === "ok") {
      const a = primary.status === "ok" ? primary.meta : null;
      const b = fallback.status === "ok" ? fallback.meta : null;
      return {
        status: "ok",
        meta: {
          v: this.config.seenValue as string,
          maxShard: Math.max(a?.maxShard ?? -1, b?.maxShard ?? -1),
          ...(a?.e != null
            ? { e: a.e }
            : b?.e != null
              ? { e: b.e }
              : {}),
        },
      };
    }
    if (primary.status === "expired" || fallback.status === "expired") {
      return {
        status: "expired",
        maxShard: Math.max(
          primary.status === "expired" ? primary.maxShard : -1,
          fallback.status === "expired" ? fallback.maxShard : -1,
        ),
      };
    }
    if (primary.status === "foreign" || fallback.status === "foreign") {
      return {
        status: "foreign",
        maxShard: Math.max(
          primary.status === "foreign" ? primary.maxShard : -1,
          fallback.status === "foreign" ? fallback.maxShard : -1,
        ),
      };
    }
    return { status: "missing" };
  }

  /**
   * Persist journey metadata with a stable shared expiry.
   *
   * @param meta Metadata to store
   * @returns Whether at least one adapter retained the value
   * @internal
   */
  private writeMeta(meta: SeenMeta): boolean {
    const key = this.metaKey();
    const serialized = JSON.stringify(meta);
    this.config.storage.set(key, serialized);
    if (this.config.fallbackStorage) {
      this.config.fallbackStorage.set(key, serialized);
    }
    return this.verifyWrite(key, serialized, -1);
  }

  /**
   * Create or reuse journey metadata for the current version. Expiry is set
   * once per version so later shard writes cannot leave older shards expired.
   *
   * @param minShard Shard that must be covered by maxShard
   * @returns Metadata for subsequent shard writes
   * @internal
   */
  private ensureMeta(minShard: number): SeenMeta | null {
    if (!this.config.seenValue) return null;
    const state = this.readMetaState();
    const existing = state.status === "ok" ? state.meta : null;
    const meta: SeenMeta = {
      v: this.config.seenValue,
      maxShard: Math.max(existing?.maxShard ?? -1, minShard),
      ...(existing?.e != null
        ? { e: existing.e }
        : this.config.fallbackDays != null
          ? { e: Date.now() + this.config.fallbackDays * 864e5 }
          : {}),
    };
    this.writeMeta(meta);
    return meta;
  }

  /**
   * Parse one persisted shard for the current version.
   *
   * @param raw Serialized shard value
   * @param shard Expected shard number
   * @returns Valid indexes belonging to the shard, or null for absent/invalid state
   * @internal
   */
  private parseShard(raw: string | null, shard: number): Set<number> | null {
    if (!raw || !this.config.seenValue) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SeenState>;
      if (
        parsed &&
        parsed.v === this.config.seenValue &&
        Array.isArray(parsed.seen)
      ) {
        const min = shard * SEEN_SHARD_SIZE;
        const max = Math.min(min + SEEN_SHARD_SIZE, this.steps.length);
        return new Set(
          parsed.seen.filter(
            (value): value is number =>
              Number.isInteger(value) && value >= min && value < max,
          ),
        );
      }
    } catch {
      /* malformed state is treated as an absent shard */
    }
    return null;
  }

  /**
   * Read one shard, merging the primary adapter with localStorage fallback
   * state when cookie persistence is selected.
   *
   * @param shard Zero-based shard number
   * @returns Seen indexes and whether current-version shard state was found
   * @internal
   */
  private readShard(shard: number): {
    seen: Set<number>;
    found: boolean;
  } {
    const key = this.shardKey(shard);
    const primary = this.parseShard(this.config.storage.get(key), shard);
    const fallback = this.config.fallbackStorage
      ? this.parseShard(this.config.fallbackStorage.get(key), shard)
      : null;
    return {
      seen: new Set([...(primary ?? []), ...(fallback ?? [])]),
      found: primary !== null || fallback !== null,
    };
  }

  /**
   * Verify that a write stuck in the primary adapter and/or cookie fallback.
   * Warns once when persistence is unavailable, and also when the configured
   * localStorage mirror fails even if the cookie write succeeded.
   *
   * @param key Storage key that was written
   * @param serialized Expected serialized value
   * @param shard Shard number for diagnostics, or -1 for metadata
   * @returns Whether at least one adapter retained the value
   * @internal
   */
  private verifyWrite(
    key: string,
    serialized: string,
    shard: number,
  ): boolean {
    const primarySaved = this.config.storage.get(key) === serialized;
    const fallbackConfigured = this.config.fallbackStorage != null;
    const fallbackSaved = fallbackConfigured
      ? this.config.fallbackStorage?.get(key) === serialized
      : true;

    if (!primarySaved && !fallbackSaved) {
      if (!this.persistenceWarningShown) {
        this.persistenceWarningShown = true;
        // eslint-disable-next-line no-console
        console.warn(
          `ReleaseHighlighter: unable to persist seen steps${
            shard >= 0 ? ` (first failed shard: ${shard})` : " metadata"
          }`,
        );
      }
      return false;
    }

    if (
      fallbackConfigured &&
      !fallbackSaved &&
      !this.persistenceWarningShown
    ) {
      this.persistenceWarningShown = true;
      // eslint-disable-next-line no-console
      console.warn(
        `ReleaseHighlighter: localStorage mirror failed${
          shard >= 0 ? ` for shard ${shard}` : " for seen metadata"
        }`,
      );
    }

    return primarySaved || (fallbackConfigured && fallbackSaved === true);
  }

  /**
   * Persist one shard. Cookie writes are verified by reading them back; if a
   * browser rejects or evicts the cookie, localStorage retains the same shard.
   *
   * @param shard Zero-based shard number
   * @param seen Seen indexes belonging to the shard
   * @returns Whether at least one adapter retained the shard
   * @internal
   */
  private writeShard(shard: number, seen: Set<number>): boolean {
    if (!this.config.seenValue) return false;
    const key = this.shardKey(shard);
    const state: SeenState = {
      v: this.config.seenValue,
      seen: Array.from(seen).sort((a, b) => a - b),
    };
    const serialized = JSON.stringify(state);
    this.config.storage.set(key, serialized);
    if (this.config.fallbackStorage) {
      this.config.fallbackStorage.set(key, serialized);
    }
    return this.verifyWrite(key, serialized, shard);
  }

  /**
   * Read legacy selector-based state from the unsharded storage key and map it
   * to manifest indexes. Numeric legacy values are accepted too.
   *
   * @returns Migrated indexes, or null when no compatible legacy state exists
   * @internal
   */
  private readLegacySeenSet(): Set<number> | null {
    if (!this.config.seenValue) return null;
    const primary = this.config.storage.get(this.config.storageKey);
    const fallback = this.config.fallbackStorage?.get(this.config.storageKey);
    const raw = primary ?? fallback ?? null;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        v?: unknown;
        seen?: unknown;
        e?: unknown;
      };
      if (
        parsed.v !== this.config.seenValue ||
        !Array.isArray(parsed.seen)
      ) {
        return null;
      }
      if (
        parsed.e != null &&
        !(
          typeof parsed.e === "number" &&
          Number.isFinite(parsed.e) &&
          Date.now() < parsed.e
        )
      ) {
        this.removeKey(this.config.storageKey);
        return null;
      }

      const migrated = new Set<number>();
      for (const value of parsed.seen) {
        if (
          Number.isInteger(value) &&
          (value as number) >= 0 &&
          (value as number) < this.steps.length
        ) {
          migrated.add(value as number);
        } else if (typeof value === "string") {
          this.steps.forEach((step, index) => {
            if (step.target === value) migrated.add(index);
          });
        }
      }
      return migrated;
    } catch {
      return null;
    }
  }

  /**
   * Persist an entire seen set into independent 250-index shards.
   *
   * @param seen Manifest indexes to persist
   * @returns Whether every required shard (including an empty shard-0 tombstone) was saved
   * @internal
   */
  private writeSeenSet(seen: Set<number>): boolean {
    const shards = new Map<number, Set<number>>();
    for (const stepIndex of seen) {
      const shard = Math.floor(stepIndex / SEEN_SHARD_SIZE);
      const values = shards.get(shard) ?? new Set<number>();
      values.add(stepIndex);
      shards.set(shard, values);
    }
    if (!shards.has(0)) shards.set(0, new Set());

    const maxShard = Math.max(...shards.keys());
    const meta = this.ensureMeta(maxShard);
    if (!meta) return false;

    let ok = true;
    for (const [shard, values] of shards) {
      ok = this.writeShard(shard, values) && ok;
    }
    return ok;
  }

  /**
   * Drop shard/meta keys beyond the active range after a version change or
   * manifest shrink so cookie slots can be reused.
   *
   * @param keepThrough Inclusive highest shard to retain
   * @param previousMax Inclusive highest shard previously recorded
   * @internal
   */
  private pruneShards(keepThrough: number, previousMax: number): void {
    for (let shard = keepThrough + 1; shard <= previousMax; shard += 1) {
      this.removeKey(this.shardKey(shard));
    }
  }

  /**
   * Read all seen indexes for the current version. Selector-based state from
   * releases before sharding is migrated and cleared only after every required
   * shard verifies successfully.
   *
   * @returns Seen manifest indexes
   * @internal
   */
  private getSeenSet(): Set<number> {
    if (this.config.force || !this.config.seenValue) return new Set();

    const neededShards = Math.max(
      1,
      Math.ceil(this.steps.length / SEEN_SHARD_SIZE),
    );
    const metaState = this.readMetaState();

    if (metaState.status === "expired") {
      this.removeKey(this.metaKey());
      this.pruneShards(-1, Math.max(metaState.maxShard, neededShards - 1));
      this.removeKey(this.config.storageKey);
      return new Set();
    }

    if (metaState.status === "foreign") {
      // Reuse cookie slots from a previous version.
      this.removeKey(this.metaKey());
      this.pruneShards(-1, Math.max(metaState.maxShard, neededShards - 1));
    }

    const meta = metaState.status === "ok" ? metaState.meta : null;
    if (meta) this.pruneShards(neededShards - 1, meta.maxShard);

    const seen = new Set<number>();
    const shardCount = Math.max(neededShards, (meta?.maxShard ?? -1) + 1);
    for (let shard = 0; shard < shardCount; shard += 1) {
      const state = this.readShard(shard);
      for (const stepIndex of state.seen) seen.add(stepIndex);
    }

    const legacy = this.readLegacySeenSet();
    if (legacy) {
      for (const stepIndex of legacy) seen.add(stepIndex);
      // Keep merging legacy until every shard write verifies, then delete it so
      // expired shards cannot resurrect progress from the old blob.
      if (this.writeSeenSet(seen)) {
        this.removeKey(this.config.storageKey);
      }
    }

    return seen;
  }

  /**
   * Mark a manifest step index as seen. Shards are created lazily and contain
   * at most 250 indexes, so the public API has no manifest step limit.
   *
   * @param stepIndex Zero-based position in the manifest
   * @internal
   */
  private markStepSeen(stepIndex: number): void {
    if (
      this.config.force ||
      !this.config.seenValue ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 0
    ) {
      return;
    }
    const shard = Math.floor(stepIndex / SEEN_SHARD_SIZE);
    this.ensureMeta(shard);
    // Re-read immediately before writing so concurrent tabs are less likely to
    // clobber each other's indexes.
    const state = this.readShard(shard);
    if (state.seen.has(stepIndex)) return;
    state.seen.add(stepIndex);
    const latest = this.readShard(shard);
    for (const value of latest.seen) state.seen.add(value);
    state.seen.add(stepIndex);
    this.writeShard(shard, state.seen);
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
    for (const [stepIndex, step] of this.steps.entries()) {
      if (seen.has(stepIndex)) continue; // already shown for this version
      // Presence-based (not viewport-based) so the step count is stable
      // regardless of where the user has scrolled. Only the first matching
      // element per target is used.
      const element = pickTarget(step.target, this.config.skipHiddenTargets);
      if (!element) continue;
      active.push({ step, element, stepIndex });
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
    const { step, element, stepIndex } = this.active[this.currentIndex];
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
    this.markStepSeen(stepIndex);
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
   * Shared teardown: unbind listeners, destroy the UI, and release target
   * element references. Leaves the instance reusable. Per-step "seen" state is
   * persisted at display time, not here.
   * @internal
   */
  private end(): void {
    this.unbindGlobalListeners();
    this.ui?.destroy();
    this.ui = null;
    this.active = [];
    this.currentIndex = 0;
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
