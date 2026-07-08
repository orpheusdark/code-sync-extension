export type FloatingSyncButtonState = 'idle' | 'loading' | 'success' | 'failure' | 'duplicate';

export interface FloatingSyncButtonOptions {
  label: string;
  onClick: () => Promise<void> | void;
  onMount?: () => void;
  onUnmount?: () => void;
}

export class FloatingSyncButton {
  private readonly host: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private readonly button: HTMLButtonElement;
  private readonly toast: HTMLDivElement;
  private readonly options: FloatingSyncButtonOptions;
  private resetTimer: number | null = null;
  private mounted = false;

  constructor(options: FloatingSyncButtonOptions) {
    this.options = options;
    this.host = document.createElement('div');
    this.host.id = 'codesync-floating-button-host';
    this.host.style.all = 'initial';
    this.host.style.position = 'fixed';
    this.host.style.right = '18px';
    this.host.style.bottom = '18px';
    this.host.style.zIndex = '2147483647';
    this.host.style.pointerEvents = 'auto';

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
          gap: 10px;
          border: none;
          border-radius: 16px;
          padding: 12px 16px;
          min-height: 48px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          color: #f9fafb;
          background: linear-gradient(135deg, #0f172a, #1f2937);
          box-shadow: 0 16px 35px rgba(15, 23, 42, 0.26);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease, background 160ms ease;
          backdrop-filter: blur(14px);
        }

        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.32);
        }

        .button:active {
          transform: translateY(0);
        }

        .button[data-state='loading'] {
          cursor: progress;
          opacity: 0.95;
        }

        .button[data-state='success'] {
          background: linear-gradient(135deg, #15803d, #166534);
        }

        .button[data-state='failure'] {
          background: linear-gradient(135deg, #b91c1c, #991b1b);
        }

        .button[data-state='duplicate'] {
          background: linear-gradient(135deg, #0f766e, #115e59);
        }

        .icon-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .icon {
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: currentColor;
          flex: 0 0 auto;
        }

        .label {
          letter-spacing: 0.01em;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.28);
          border-top-color: currentColor;
          border-radius: 999px;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          :host {
            position: fixed;
          }

          .button {
            padding: 11px 14px;
            min-height: 44px;
          }
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
        <button class="button" id="button" type="button" data-state="idle" aria-label="${options.label}">
          <span class="icon-row">
            <span class="icon" id="leftIcon"></span>
            <span class="icon" id="rightIcon"></span>
            <span class="label" id="label"></span>
          </span>
        </button>
      </div>
    `;

    const button = this.shadow.getElementById('button');
    const label = this.shadow.getElementById('label');
    const leftIcon = this.shadow.getElementById('leftIcon');
    const rightIcon = this.shadow.getElementById('rightIcon');
    const toast = this.shadow.getElementById('toast');

    if (!button || !label || !leftIcon || !rightIcon || !toast) {
      throw new Error('Unable to initialize floating sync button.');
    }

    this.button = button as HTMLButtonElement;
    this.toast = toast as HTMLDivElement;
    label.textContent = options.label;
    leftIcon.innerHTML = githubIconSvg();
    rightIcon.innerHTML = syncIconSvg();

    this.button.addEventListener('click', () => {
      void this.options.onClick();
    });
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.mounted = true;
    document.body.appendChild(this.host);
    this.options.onMount?.();
    this.syncTheme();
  }

  destroy(): void {
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.options.onUnmount?.();
    this.host.remove();
    this.mounted = false;
  }

  setState(state: FloatingSyncButtonState, label?: string): void {
    this.button.dataset.state = state;
    this.button.disabled = state === 'loading';

    const labelElement = this.shadow.getElementById('label');
    const leftIcon = this.shadow.getElementById('leftIcon');
    const rightIcon = this.shadow.getElementById('rightIcon');
    if (!labelElement || !leftIcon || !rightIcon) {
      return;
    }

    const text = label || this.getStateLabel(state);
    labelElement.textContent = text;

    if (state === 'loading') {
      leftIcon.innerHTML = '<span class="spinner" aria-hidden="true"></span>';
      rightIcon.innerHTML = '';
      return;
    }

    leftIcon.innerHTML = githubIconSvg();
    rightIcon.innerHTML = state === 'duplicate' ? checkIconSvg(true) : syncIconSvg();
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

  private getStateLabel(state: FloatingSyncButtonState): string {
    switch (state) {
      case 'loading':
        return 'Syncing...';
      case 'success':
        return '✓ Synced';
      case 'failure':
        return 'Retry';
      case 'duplicate':
        return 'Already Synced';
      case 'idle':
      default:
        return this.options.label;
    }
  }
}

function githubIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.08.55-.17.55-.38v-1.3c-2.22.48-2.69-1.06-2.69-1.06-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.53.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .22.15.47.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
    </svg>
  `;
}

function syncIconSvg(): string {
  return `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 8a5.5 5.5 0 0 1 9.67-3.58"/>
      <path d="M12 3v2.5h-2.5"/>
      <path d="M13.5 8A5.5 5.5 0 0 1 3.83 11.58"/>
      <path d="M4 13v-2.5h2.5"/>
    </svg>
  `;
}

function checkIconSvg(duplicate = false): string {
  return `
    <svg viewBox="0 0 16 16" fill="none" stroke="${duplicate ? 'currentColor' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>
    </svg>
  `;
}
