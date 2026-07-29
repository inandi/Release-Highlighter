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
 * Load a JSON manifest from `url`.
 *
 * Expected shape:
 * `{ "version": "2.1.0", "expires?": "…", "steps": [ { "target": ".x", "body": "…" } ] }`
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
        if (!raw || typeof raw !== "object" || typeof raw.target !== "string" || !raw.target.trim()) {
            throw new Error("each step must have a non-empty string 'target' (CSS selector)");
        }
        steps.push(raw as Step);
    }

    return { version: data.version, steps, expires: data.expires };
}
