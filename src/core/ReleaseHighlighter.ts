import Cookies from 'js-cookie';

export interface HighlightOptions {
    highlightClass?: string;
    duration?: number;
    cookieExpiry?: number;
    onHighlight?: (element: HTMLElement) => void;
    onComplete?: () => void;
}

export interface ChangeInfo {
    selector: string;
    description: string;
    version: string;
}

export class ReleaseHighlighter {
    private readonly options: Required<HighlightOptions>;
    private readonly cookiePrefix = 'ui-highlight-';
    private highlightedElements: HTMLElement[] = [];

    constructor(options: HighlightOptions = {}) {
        this.options = {
            highlightClass: options.highlightClass || 'ui-highlight-new',
            duration: options.duration || 3000,
            cookieExpiry: options.cookieExpiry || 30, // days
            onHighlight: options.onHighlight || ((element: HTMLElement) => {}),
            onComplete: options.onComplete || (() => {})
        };

        // Add default highlight style if not exists
        this.ensureStyleExists();
    }

    private ensureStyleExists() {
        if (!document.getElementById('ui-highlighter-style')) {
            const style = document.createElement('style');
            style.id = 'ui-highlighter-style';
            style.textContent = `
                .${this.options.highlightClass} {
                    animation: highlight-pulse 2s infinite;
                    position: relative;
                }
                @keyframes highlight-pulse {
                    0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(66, 133, 244, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    private getCookieKey(version: string): string {
        return `${this.cookiePrefix}${version}`;
    }

    private hasBeenShown(version: string): boolean {
        return !!Cookies.get(this.getCookieKey(version));
    }

    private markAsShown(version: string): void {
        Cookies.set(this.getCookieKey(version), 'true', { expires: this.options.cookieExpiry });
    }

    private async highlightElement(element: HTMLElement, info: ChangeInfo): Promise<void> {
        element.classList.add(this.options.highlightClass);
        
        // Add tooltip with description
        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10000;
            max-width: 200px;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
        `;
        tooltip.textContent = `${info.description} (v${info.version})`;
        element.appendChild(tooltip);
        
        this.highlightedElements.push(element);
        this.options.onHighlight(element);

        return new Promise((resolve) => {
            setTimeout(() => {
                element.classList.remove(this.options.highlightClass);
                tooltip.remove();
                resolve();
            }, this.options.duration);
        });
    }

    public async highlightChanges(changes: ChangeInfo[]): Promise<void> {
        const pendingHighlights: Promise<void>[] = [];

        for (const change of changes) {
            if (this.hasBeenShown(change.version)) continue;

            const elements = document.querySelectorAll<HTMLElement>(change.selector);
            elements.forEach(element => {
                pendingHighlights.push(this.highlightElement(element, change));
            });

            this.markAsShown(change.version);
        }

        await Promise.all(pendingHighlights);
        this.options.onComplete();
    }

    public clearHighlights(): void {
        this.highlightedElements.forEach(element => {
            element.classList.remove(this.options.highlightClass);
            const tooltip = element.querySelector('div');
            if (tooltip) tooltip.remove();
        });
        this.highlightedElements = [];
    }

    public clearHistory(): void {
        const cookies = Cookies.get();
        Object.keys(cookies).forEach(key => {
            if (key.startsWith(this.cookiePrefix)) {
                Cookies.remove(key);
            }
        });
    }

    public foo(q = "test"): string {
        return q;
    }
} 