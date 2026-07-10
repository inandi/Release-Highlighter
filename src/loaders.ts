import type { Step } from "./types";

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
