export { ReleaseHighlighter } from "./core";
export { loadJson } from "./loaders";
export {
    cookieStorage,
    localStorageAdapter,
    memoryStorage,
} from "./storage";

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
