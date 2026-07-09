/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export interface AppearanceSettings {
  theme: 'system' | 'dark' | 'light' | 'oled';
  accent: 'blue' | 'purple' | 'green' | 'orange' | 'red';
}

export const APPEARANCE_KEY = 'codesync.appearance';

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  accent: 'blue'
};

export function applyTheme(theme: AppearanceSettings['theme']): void {
  document.documentElement.dataset.theme = theme;
}

export function applyAccent(accent: AppearanceSettings['accent']): void {
  if (accent === 'blue') {
    document.documentElement.removeAttribute('data-accent');
    return;
  }

  document.documentElement.setAttribute('data-accent', accent);
}

export function applyAppearance(settings: AppearanceSettings): void {
  applyTheme(settings.theme);
  applyAccent(settings.accent);
}
