/**
 * Release Highlighter - Storage adapters
 *
 * @file Built-in cookie persistence and an internal localStorage mirror used to
 * harden the cookie path. Custom adapters are supplied by integrators.
 * @license MIT
 *
 * Simple release-journey / product-tour plugin for the web. JSON-manifest driven.
 *
 * @author Gobinda Nandi <gobinda.nandi.public@gmail.com>
 * @since 1.1.1
 * @version 1.1.6
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
  try {
    const nameEq = encodeURIComponent(name) + "=";
    const parts = document.cookie.split("; ");
    for (const part of parts) {
      if (part.startsWith(nameEq)) {
        return decodeURIComponent(part.substring(nameEq.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Set a SameSite=Lax cookie with a specified name, value, and lifetime.
 * `days <= 0` creates a session cookie (no Expires attribute).
 * @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
 *
 * @param name Cookie name
 * @param value Raw value to store (will be encoded)
 * @param days Lifetime in days; <= 0 means session
 */
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === "undefined") return;
  try {
    const lifetime =
      days > 0
        ? `; Expires=${new Date(Date.now() + days * 864e5).toUTCString()}`
        : "";
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${lifetime}; Path=/; SameSite=Lax`;
  } catch {
    /* blocked cookie access is handled by write verification in the core */
  }
}

/**
 * Delete a cookie by writing an expired value.
 *
 * @param name Cookie name
 */
function removeCookie(name: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${encodeURIComponent(name)}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`;
  } catch {
    /* ignore blocked cookie access */
  }
}

/**
 * Cookie-backed storage adapter (the built-in persistence backend).
 *
 * @param days Lifetime for the cookie value in days; <= 0 means session cookies
 * @returns StorageAdapter using document.cookie
 * @public
 */
export function cookieStorage(days: number): StorageAdapter {
  return {
    get: (key) => getCookie(key),
    set: (key, value) => setCookie(key, value, days),
    remove: (key) => removeCookie(key),
  };
}

/**
 * Internal localStorage mirror used only to harden the built-in cookie path.
 * Not part of the public storage menu — integrators who want localStorage (or
 * anything else) should pass their own {@link StorageAdapter}.
 *
 * @returns StorageAdapter using window.localStorage
 * @internal
 */
export function cookieMirrorStorage(): StorageAdapter {
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
    remove: (key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore quota / privacy-mode errors */
      }
    },
  };
}

/**
 * Resolve a storage configuration to a concrete adapter.
 *
 * @param option `'cookie'`, omitted (defaults to cookie), or a custom adapter
 * @param cookieDays Lifetime for cookies when using the built-in cookie adapter
 * @returns Concrete StorageAdapter
 * @internal
 */
export function resolveStorage(
  option: StorageOption | undefined,
  cookieDays: number,
): StorageAdapter {
  if (option && typeof option === "object") return option;
  return cookieStorage(cookieDays);
}

/**
 * True when the caller asked for the built-in cookie backend (default).
 *
 * @param option Storage option from ReleaseHighlighterOptions
 * @returns Whether cookie hardening (mirror) should be enabled
 * @internal
 */
export function isBuiltInCookieStorage(
  option: StorageOption | undefined,
): boolean {
  return option == null || option === "cookie";
}
