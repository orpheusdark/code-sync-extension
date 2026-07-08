const FLOATING_BUTTON_POSITION_KEY = 'codesync.floatingButtonPosition';

function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export type FloatingSyncButtonState = 'idle' | 'loading' | 'success' | 'failure' | 'duplicate';

type SnapEdge = 'left' | 'right' | 'top' | 'bottom';

interface SavedButtonPosition {
  edge: SnapEdge;
  offset: number;
}

export interface FloatingSyncButtonOptions {
  onClick: () => Promise<void> | void;
  onMount?: () => void;
  onUnmount?: () => void;
}

const EDGE_MARGIN = 16;
const DEFAULT_BUTTON_WIDTH = 148;
const DEFAULT_BUTTON_HEIGHT = 44;
const DRAG_THRESHOLD = 6;

export class FloatingSyncButton {
  private readonly host: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private readonly button: HTMLButtonElement;
  private readonly content: HTMLSpanElement;
  private readonly toast: HTMLDivElement;
  private readonly options: FloatingSyncButtonOptions;
  private readonly logoUrl: string;
  private resetTimer: number | null = null;
  private mounted = false;
  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private hostStartX = 0;
  private hostStartY = 0;
  private didDrag = false;

  constructor(options: FloatingSyncButtonOptions) {
    this.options = options;
    this.logoUrl = getLogoUrl();

    this.host = document.createElement('div');
    this.host.id = 'codesync-floating-button-host';
    this.host.style.position = 'fixed';
    this.host.style.zIndex = '2147483647';
    this.host.style.pointerEvents = 'auto';
    this.host.style.width = 'auto';
    this.host.style.height = 'auto';
    this.host.style.margin = '0';
    this.host.style.padding = '0';
    this.host.style.border = '0';
    this.host.style.background = 'transparent';

    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `
      <style>
        :host {
          color-scheme: light dark;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          pointer-events: none;
        }

        .toast {
          pointer-events: none;
          opacity: 0;
          transform: translateY(8px) scale(0.98);
          transition: opacity 180ms ease, transform 180ms ease;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(17, 24, 39, 0.92);
          color: #f9fafb;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          max-width: min(320px, calc(100vw - 32px));
          font-size: 12px;
          line-height: 1.4;
          white-space: pre-line;
        }

        :host([data-theme='light']) .toast {
          background: rgba(255, 255, 255, 0.96);
          color: #111827;
          border-color: rgba(15, 23, 42, 0.1);
        }

        .toast.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .button {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: none;
          border-radius: 999px;
          min-height: 44px;
          padding: 10px 16px 10px 12px;
          cursor: grab;
          color: #f8fbff;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04)),
            linear-gradient(135deg, #638fff 0%, #7c6cf0 52%, #a78bfa 100%);
          box-shadow:
            0 14px 34px rgba(99, 143, 255, 0.34),
            0 4px 12px rgba(15, 23, 42, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.24);
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, filter 160ms ease;
          backdrop-filter: blur(14px);
          touch-action: none;
          white-space: nowrap;
        }

        .button:hover {
          transform: translateY(-2px);
          filter: brightness(1.04);
          box-shadow:
            0 18px 42px rgba(99, 143, 255, 0.42),
            0 6px 16px rgba(15, 23, 42, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        .button:active {
          cursor: grabbing;
          transform: translateY(0);
        }

        .button[data-state='loading'] {
          cursor: progress;
          opacity: 0.96;
        }

        .button[data-state='success'] {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow:
            0 14px 34px rgba(16, 185, 129, 0.28),
            0 4px 12px rgba(15, 23, 42, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        .button[data-state='failure'] {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow:
            0 14px 34px rgba(239, 68, 68, 0.28),
            0 4px 12px rgba(15, 23, 42, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        .button[data-state='duplicate'] {
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.02)),
            linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
          box-shadow:
            0 14px 34px rgba(20, 184, 166, 0.28),
            0 4px 12px rgba(15, 23, 42, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
        }

        :host([data-theme='light']) .button {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.34);
        }

        .content {
          display: inline-flex;
          align-items: center;
          gap: 9px;
        }

        .logo {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          flex: 0 0 auto;
          display: block;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        }

        .label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          line-height: 1;
        }

        .icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .icon svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.28);
          border-top-color: currentColor;
          border-radius: 999px;
          animation: spin 0.8s linear infinite;
          flex: 0 0 auto;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .button,
          .toast {
            transition: none;
          }

          .spinner {
            animation: none;
          }
        }
      </style>
      <div class="wrap">
        <div class="toast" id="toast"></div>
        <button class="button" id="button" type="button" data-state="idle" aria-label="Sync with Code Sync">
          <span class="content" id="content"></span>
        </button>
      </div>
    `;

    const button = this.shadow.getElementById('button');
    const content = this.shadow.getElementById('content');
    const toast = this.shadow.getElementById('toast');

    if (!button || !content || !toast) {
      throw new Error('Unable to initialize floating sync button.');
    }

    this.button = button as HTMLButtonElement;
    this.content = content as HTMLSpanElement;
    this.toast = toast as HTMLDivElement;
    this.renderContent('idle');

    this.button.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.button.addEventListener('click', (event) => {
      if (this.didDrag) {
        event.preventDefault();
        event.stopPropagation();
        this.didDrag = false;
        return;
      }

      void this.options.onClick();
    });
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.mounted = true;
    const mountTarget = document.body ?? document.documentElement;
    mountTarget.appendChild(this.host);
    this.applyPosition(this.getDefaultPosition());
    void this.restorePosition();
    window.addEventListener('resize', this.onWindowResize);
    this.options.onMount?.();
    this.syncTheme();
  }

  destroy(): void {
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    window.removeEventListener('resize', this.onWindowResize);
    this.endDragListeners();
    this.options.onUnmount?.();
    this.host.remove();
    this.mounted = false;
  }

  setState(state: FloatingSyncButtonState): void {
    this.button.dataset.state = state;
    this.button.disabled = state === 'loading';
    this.renderContent(state);
  }

  showToast(message: string, variant: 'success' | 'error' | 'duplicate' | 'info' = 'info'): void {
    this.toast.textContent = message;
    this.toast.dataset.variant = variant;
    this.toast.classList.add('visible');

    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
    }

    this.resetTimer = window.setTimeout(() => {
      this.toast.classList.remove('visible');
      this.resetTimer = null;
    }, 2600);
  }

  syncTheme(): void {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.host.dataset.theme = isDark ? 'dark' : 'light';
  }

  private renderContent(state: FloatingSyncButtonState): void {
    if (state === 'loading') {
      this.content.innerHTML = `
        <span class="spinner" aria-hidden="true"></span>
        <span class="label">Syncing…</span>
      `;
      this.button.setAttribute('aria-label', 'Syncing with Code Sync');
      return;
    }

    if (state === 'success') {
      this.content.innerHTML = `
        <span class="icon">${checkIconSvg()}</span>
        <span class="label">Synced</span>
      `;
      this.button.setAttribute('aria-label', 'Synced to GitHub');
      return;
    }

    if (state === 'failure') {
      this.content.innerHTML = `
        <span class="icon">${retryIconSvg()}</span>
        <span class="label">Retry</span>
      `;
      this.button.setAttribute('aria-label', 'Retry sync with Code Sync');
      return;
    }

    if (state === 'duplicate') {
      this.content.innerHTML = `
        <span class="icon">${checkIconSvg()}</span>
        <span class="label">Already synced</span>
      `;
      this.button.setAttribute('aria-label', 'Already synced with Code Sync');
      return;
    }

    this.content.innerHTML = `
      <img class="logo" src="${this.logoUrl}" alt="" width="24" height="24" />
      <span class="label">Code Sync</span>
    `;
    this.button.setAttribute('aria-label', 'Sync with Code Sync');
  }

  private getHostSize(): { width: number; height: number } {
    const rect = this.host.getBoundingClientRect();
    return {
      width: rect.width > 0 ? rect.width : DEFAULT_BUTTON_WIDTH,
      height: rect.height > 0 ? rect.height : DEFAULT_BUTTON_HEIGHT
    };
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.button.disabled) {
      return;
    }

    this.dragPointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.hostStartX = this.host.offsetLeft;
    this.hostStartY = this.host.offsetTop;
    this.didDrag = false;

    this.host.style.right = 'auto';
    this.host.style.bottom = 'auto';
    this.host.style.left = `${this.hostStartX}px`;
    this.host.style.top = `${this.hostStartY}px`;

    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    if (!this.didDrag && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
      return;
    }

    this.didDrag = true;

    const { width, height } = this.getHostSize();
    const maxX = window.innerWidth - width - EDGE_MARGIN;
    const maxY = window.innerHeight - height - EDGE_MARGIN;
    const nextX = clamp(this.hostStartX + deltaX, EDGE_MARGIN, maxX);
    const nextY = clamp(this.hostStartY + deltaY, EDGE_MARGIN, maxY);

    this.host.style.left = `${nextX}px`;
    this.host.style.top = `${nextY}px`;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.dragPointerId !== event.pointerId) {
      return;
    }

    this.endDragListeners();

    if (this.didDrag) {
      const rect = this.host.getBoundingClientRect();
      const snapped = snapToEdge(rect.left, rect.top, rect.width, rect.height);
      this.applyPosition(snapped);
      void this.savePosition(snapped);
    }

    this.dragPointerId = null;
  };

  private endDragListeners(): void {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  private applyPosition(position: SavedButtonPosition): void {
    const { width, height } = this.getHostSize();
    const maxOffsetX = window.innerWidth - width - EDGE_MARGIN * 2;
    const maxOffsetY = window.innerHeight - height - EDGE_MARGIN * 2;
    const offsetX = clamp(position.offset, EDGE_MARGIN, maxOffsetX);
    const offsetY = clamp(position.offset, EDGE_MARGIN, maxOffsetY);

    this.host.style.left = 'auto';
    this.host.style.right = 'auto';
    this.host.style.top = 'auto';
    this.host.style.bottom = 'auto';

    switch (position.edge) {
      case 'left':
        this.host.style.left = `${EDGE_MARGIN}px`;
        this.host.style.top = `${offsetY}px`;
        break;
      case 'right':
        this.host.style.right = `${EDGE_MARGIN}px`;
        this.host.style.top = `${offsetY}px`;
        break;
      case 'top':
        this.host.style.top = `${EDGE_MARGIN}px`;
        this.host.style.left = `${offsetX}px`;
        break;
      case 'bottom':
        this.host.style.bottom = `${EDGE_MARGIN}px`;
        this.host.style.left = `${offsetX}px`;
        break;
    }
  }

  private getDefaultPosition(): SavedButtonPosition {
    const { height } = this.getHostSize();
    return {
      edge: 'right',
      offset: Math.max(EDGE_MARGIN, window.innerHeight - height - 96)
    };
  }

  private onWindowResize = (): void => {
    void this.restorePosition();
  };

  private async restorePosition(): Promise<void> {
    if (!isExtensionContextValid()) {
      this.applyPosition(this.getDefaultPosition());
      return;
    }

    try {
      const result = await chrome.storage.local.get(FLOATING_BUTTON_POSITION_KEY);
      const saved = result[FLOATING_BUTTON_POSITION_KEY] as SavedButtonPosition | undefined;
      if (saved?.edge && typeof saved.offset === 'number') {
        this.applyPosition(saved);
        return;
      }
    } catch {
      // Use default position.
    }

    this.applyPosition(this.getDefaultPosition());
  }

  private async savePosition(position: SavedButtonPosition): Promise<void> {
    if (!isExtensionContextValid()) {
      return;
    }

    try {
      await chrome.storage.local.set({
        [FLOATING_BUTTON_POSITION_KEY]: position
      });
    } catch {
      // Ignore persistence errors.
    }
  }
}

function snapToEdge(x: number, y: number, width: number, height: number): SavedButtonPosition {
  const distLeft = x;
  const distRight = window.innerWidth - x - width;
  const distTop = y;
  const distBottom = window.innerHeight - y - height;
  const min = Math.min(distLeft, distRight, distTop, distBottom);

  if (min === distLeft) {
    return { edge: 'left', offset: y };
  }

  if (min === distRight) {
    return { edge: 'right', offset: y };
  }

  if (min === distTop) {
    return { edge: 'top', offset: x };
  }

  return { edge: 'bottom', offset: x };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getLogoUrl(): string {
  try {
    return chrome.runtime.getURL('icons/icon32.png');
  } catch {
    return '';
  }
}

function checkIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>
    </svg>
  `;
}

function retryIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 8a5.5 5.5 0 0 1 9.67-3.58"/>
      <path d="M12 3v2.5h-2.5"/>
      <path d="M13.5 8A5.5 5.5 0 0 1 3.83 11.58"/>
      <path d="M4 13v-2.5h2.5"/>
    </svg>
  `;
}
