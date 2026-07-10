import type { StorageAdapter, StorageOption } from "./types";

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

function setCookie(name: string, value: string, days: number): void {
    if (typeof document === "undefined") return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax`;
}

export function cookieStorage(days: number): StorageAdapter {
    return {
        get: (key) => getCookie(key),
        set: (key, value) => setCookie(key, value, days),
    };
}

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

export function memoryStorage(): StorageAdapter {
    const map = new Map<string, string>();
    return {
        get: (key) => (map.has(key) ? (map.get(key) as string) : null),
        set: (key, value) => {
            map.set(key, value);
        },
    };
}

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
