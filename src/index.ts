/**
 * Release Highlighter - Public entrypoint
 *
 * @file Package exports for public API.
 * @license MIT
 *
 * Simple release-journey / product-tour plugin for the web. JSON-manifest driven.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.6
 * @copyright (c) 2026 Gobinda Nandi
 */

export { ReleaseHighlighter } from "./core";
export { loadJson } from "./loaders";
export { cookieStorage, localStorageAdapter, memoryStorage } from "./storage";

export type {
  ReleaseHighlighterOptions,
  Step,
  StepContent,
  ManifestStep,
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
