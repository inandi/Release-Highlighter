/**
 * Release Highlighter - Public entrypoint
 *
 * @file Package exports for public API.
 * @license MIT
 *
 * Simple, highly customizable release-journey / product-tour plugin for the web.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

export { ReleaseHighlighter } from "./core";
export { loadJson } from "./loaders";
export { cookieStorage, localStorageAdapter, memoryStorage } from "./storage";

export type {
  ReleaseHighlighterOptions,
  Step,
  StepTarget,
  Placement,
  Theme,
  Labels,
  Hooks,
  JourneyApi,
  StorageAdapter,
  StorageOption,
} from "./types";

import { ReleaseHighlighter } from "./core";
export default ReleaseHighlighter;
