/**
 * Release Highlighter - Manifest loaders
 *
 * @file Utilities to fetch and validate JSON manifests for journeys.
 * @license MIT
 *
 * Simple, highly customizable release-journey / product-tour plugin for the web.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.1
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
 * JSON manifest shape:
 * { "version": "2.1.0", "steps": [ { "target": ".x", "body": "..." } ] }
 * A bare array of steps is also accepted.
 */
/**
 * Load a JSON manifest or a bare array of steps from `url`.
 *
 * Validates 'version' (must be a single string) and optional 'expires' (UTC/ISO).
 *
 * @param url Resource URL
 * @returns Object containing optional version, steps array, and optional expires
 * @throws When validation fails
 */
export async function loadJson(
    url: string,
): Promise<{ version?: string; steps: Step[]; expires?: string }> {
    const text = await fetchText(url);
    const data = JSON.parse(text);
    if (Array.isArray(data)) return { steps: data as Step[] };
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
    return { version: data.version, steps: (data.steps || []) as Step[], expires: data.expires };
}
