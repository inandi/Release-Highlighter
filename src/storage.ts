/**
 * Release Highlighter - Storage adapters
 *
 * @file Cookie, localStorage, and memory storage adapters.
 * @license MIT
 *
 * Simple, highly customizable release-journey / product-tour plugin for the web.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.1
 * @copyright (c) 2026 Gobinda Nandi
 */

import type { StorageAdapter, StorageOption } from "./types";

/**
 * Read a cookie value by name (client-side only).
 *
 * @param name Cookie name
 * @returns Decoded cookie value or null when missing/unavailable
 */
function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const nameEq = name + "=";
    const parts = document.cookie.split("; ");
    for (const part of parts) {
        if (part.startsWith(nameEq)) {
            return decodeURIComponent(part.substring(nameEq.length));
        }
    }
    return null;
}

/**
 * Set a SameSite=Lax cookie with a specified name, value, and expiration (in days).
 * @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
 *
 * @param name Cookie name
 * @param value Raw value to store (will be encoded)
 * @param days Lifetime in days
 */
function setCookie(name: string, value: string, days: number): void {
    if (typeof document === "undefined") return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

/**
 * Cookie-backed storage adapter.
 *
 * @param days Lifetime for the cookie value in days
 * @returns StorageAdapter using document.cookie
 */
export function cookieStorage(days: number): StorageAdapter {
    return {
        get: (key) => getCookie(key),
        set: (key, value) => setCookie(key, value, days),
    };
}

/**
 * localStorage-backed storage adapter (catches quota/privacy errors).
 *
 * @returns StorageAdapter using window.localStorage
 */
export function localStorageAdapter(): StorageAdapter {
    return {
        get: (key) => {
            try {
                return window.localStorage.getItem(key);
            } catch {
                return null;
            }
        },
        set: (key, value) => {
            try {
                window.localStorage.setItem(key, value);
            } catch {
                /* ignore quota / privacy-mode errors */
            }
        },
    };
}

/**
 * In-memory storage adapter (process lifetime).
 *
 * @returns StorageAdapter backed by a Map
 */
export function memoryStorage(): StorageAdapter {
    const map = new Map<string, string>();
    return {
        get: (key) => (map.has(key) ? (map.get(key) as string) : null),
        set: (key, value) => {
            map.set(key, value);
        },
    };
}

/**
 * Resolve a storage configuration to a concrete adapter.
 *
 * @param option Either a built-in adapter name or a custom adapter
 * @param cookieDays Lifetime for cookies when using the cookie adapter
 * @returns Concrete StorageAdapter
 */
export function resolveStorage(option: StorageOption | undefined, cookieDays: number): StorageAdapter {
    if (option && typeof option === "object") return option;
    switch (option) {
        case "localStorage":
            return localStorageAdapter();
        case "memory":
            return memoryStorage();
        case "cookie":
        default:
            return cookieStorage(cookieDays);
    }
}
