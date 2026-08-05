/**
 * Release Highlighter - Manifest loaders
 *
 * @file Utilities to fetch and validate JSON manifests for journeys.
 * @license MIT
 *
 * Simple release-journey / product-tour plugin for the web. JSON-manifest driven.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.2
 * @copyright (c) 2026 Gobinda Nandi
 */

import type { Step } from "./types";

/**
 * Fetch plain text with same-origin credentials.
 *
 * @param url Resource URL
 * @returns Response text
 * @throws When the response is not OK
 */
async function fetchText(url: string): Promise<string> {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.text();
}

/**
 * Convert a bare CSS class name into a valid class selector, tolerating an
 * accidental leading dot and escaping special characters when supported.
 *
 * @param className Bare CSS class name (e.g. "release-highlighter--cart-summary")
 * @returns A class selector (e.g. ".release-highlighter--cart-summary")
 */
function classToSelector(className: string): string {
    const cleaned = className.trim().replace(/^\.+/, "");
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(cleaned) : cleaned;
    return `.${escaped}`;
}

/**
 * Load a JSON manifest from `url`.
 *
 * Expected shape:
 * `{ "version": "2.1.0", "expires?": "…", "steps": [ { "targetClass": "x", "body": "…" } ] }`
 *
 * Each step targets an element by a bare CSS class name via `targetClass`, which
 * is normalized into the runtime `target` selector.
 *
 * @param url Resource URL
 * @returns Object containing version, steps, and optional expires
 * @throws When the response fails or the manifest is invalid
 */
export async function loadJson(
    url: string,
): Promise<{ version?: string; steps: Step[]; expires?: string }> {
    const text = await fetchText(url);
    const data = JSON.parse(text);

    if (Array.isArray(data) || typeof data !== "object" || data == null) {
        throw new Error(
            "release manifest must be an object with a 'steps' array (bare step arrays are not supported)",
        );
    }
    if (!Array.isArray(data.steps)) {
        throw new Error("release manifest 'steps' must be an array");
    }
    if (data.version != null && typeof data.version !== "string") {
        throw new Error(
            "release manifest 'version' must be a single string; multiple versions are not supported",
        );
    }
    if (data.expires != null) {
        if (typeof data.expires !== "string" || Number.isNaN(Date.parse(data.expires))) {
            throw new Error("release manifest 'expires' must be a UTC/ISO date string");
        }
    }

    const steps: Step[] = [];
    for (const raw of data.steps) {
        if (!raw || typeof raw !== "object" || typeof raw.targetClass !== "string" || !raw.targetClass.trim()) {
            throw new Error("each step must have a non-empty string 'targetClass' (a CSS class name)");
        }
        const { targetClass, ...rest } = raw;
        steps.push({ ...rest, target: classToSelector(targetClass) } as Step);
    }

    return { version: data.version, steps, expires: data.expires };
}
