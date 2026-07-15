import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { APPEARANCE_KEY, applyAppearance, DEFAULT_APPEARANCE, type AppearanceSettings } from '../shared/appearance';
import { PLATFORM_OPTIONS } from '../shared/platform-logos';
import { loadState, saveState } from '../shared/storage';
import type { SyncSettings } from '../shared/types';
import { setHTML } from '../shared/dom';

// ================================================================
// TYPES & CONSTANTS
// ================================================================

type TabId = 'appearance' | 'platforms' | 'repository' | 'sync' | 'contact' | 'share' | 'about';

let activeTab: TabId = 'appearance';
let settings: SyncSettings = DEFAULT_SETTINGS;
let appearance: AppearanceSettings = DEFAULT_APPEARANCE;
let savedFlashTimer: ReturnType<typeof setTimeout> | null = null;

// ================================================================
// UTILITIES
// ================================================================
function normalizeSettings(s: SyncSettings): SyncSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    enabledPlatforms: { ...DEFAULT_SETTINGS.enabledPlatforms, ...(s.enabledPlatforms ?? {}) }
  };
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyAccent(accent: string): void {
  applyAppearance({ theme: appearance.theme, accent: accent as AppearanceSettings['accent'] });
}

// ================================================================
// ICONS (SVG)
// ================================================================
const I = {
  github:    `<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.08.55-.17.55-.38v-1.3c-2.22.48-2.69-1.06-2.69-1.06-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.53.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .22.15.47.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`,
  brush:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 13c0-1.1.9-2 2-2h2v2a2 2 0 0 1-4 0Z"/><path d="M5 11 12.5 3.5a1.41 1.41 0 0 1 2 2L7 13"/></svg>`,
  code:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4 1 8l4 4M11 4l4 4-4 4M9 2l-2 12"/></svg>`,
  repo:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z"/><path d="M5 7h6M5 10h4"/></svg>`,
  sync:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 0 1 9.67-3.58"/><path d="M12 3v2.5h-2.5"/><path d="M13.5 8A5.5 5.5 0 0 1 3.83 11.58"/><path d="M4 13v-2.5h2.5"/></svg>`,
  mail:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="14" height="10" rx="2"/><path d="m1 4 7 5 7-5"/></svg>`,
  linkedin:  `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/></svg>`,
  link:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9A4 4 0 0 0 13 9l1.5-1.5a4 4 0 0 0-5.66-5.66L7 3.5"/><path d="M9 7A4 4 0 0 0 3 7L1.5 8.5a4 4 0 0 0 5.66 5.66L9 12.5"/></svg>`,
  globe:     `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 2s-2.5 2.5-2.5 6S8 14 8 14M8 2s2.5 2.5 2.5 6S8 14 8 14M2 8h12"/></svg>`,
  discord:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z"/></svg>`,
  twitter:   `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z"/></svg>`,
  portfolio: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="10" rx="2"/><path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M8 9v.01"/></svg>`,
  copy:      `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="10" rx="2"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/></svg>`,
  check:     `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>`,
  info:      `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 5v.5"/></svg>`,
};

// ================================================================
// HTML BUILDERS — SIDEBAR
// ================================================================
function buildSidebar(): string {
  const tabs: Array<{ id: TabId; icon: string; label: string; group?: string }> = [
    { id: 'appearance',  icon: I.brush,     label: 'Appearance',  group: 'Customize' },
    { id: 'platforms',   icon: I.code,      label: 'Platforms',   group: 'Customize' },
    { id: 'repository',  icon: I.repo,      label: 'Repository',  group: 'Sync' },
    { id: 'sync',        icon: I.sync,      label: 'Sync',        group: 'Sync' },
    { id: 'contact',     icon: I.mail,      label: 'Contact',     group: 'Info' },
    { id: 'share',       icon: I.link,      label: 'Share',       group: 'Info' },
    { id: 'about',       icon: I.info,      label: 'About',       group: 'Info' },
  ];

  let lastGroup = '';
  let html = `<aside class="sidebar" role="navigation" aria-label="Settings navigation">`;

  for (const tab of tabs) {
    if (tab.group !== lastGroup) {
      html += `<div class="sidebar-section-label">${tab.group}</div>`;
      lastGroup = tab.group ?? '';
    }
    html += `
      <button class="sidebar-btn${activeTab === tab.id ? ' active' : ''}"
              id="tab-${tab.id}"
              aria-selected="${activeTab === tab.id}"
              role="tab"
              aria-controls="panel-${tab.id}">
        ${tab.icon} ${tab.label}
      </button>`;
  }

  html += `</aside>`;
  return html;
}

// ================================================================
// HTML BUILDERS — PANELS
// ================================================================
function buildAppearancePanel(): string {
  const themeOptions: Array<{ val: string; label: string; bg: string }> = [
    { val: 'system', label: 'System',  bg: 'linear-gradient(135deg,#1e293b 50%,#f8fafc 50%)' },
    { val: 'dark',   label: 'Dark',    bg: 'linear-gradient(135deg,#030712,#0f172a)' },
    { val: 'light',  label: 'Light',   bg: 'linear-gradient(135deg,#f8fafc,#e2e8f0)' },
    { val: 'oled',   label: 'OLED',    bg: '#000000' },
  ];

  const accentOptions: Array<{ val: string; color: string; label: string }> = [
    { val: 'blue',   color: '#638fff', label: 'Blue' },
    { val: 'purple', color: '#a78bfa', label: 'Purple' },
    { val: 'green',  color: '#34d399', label: 'Green' },
    { val: 'orange', color: '#fb923c', label: 'Orange' },
    { val: 'red',    color: '#f87171', label: 'Red' },
  ];

  return `
    <div class="tab-panel${activeTab === 'appearance' ? ' active' : ''}" id="panel-appearance" role="tabpanel" aria-labelledby="tab-appearance">
      <div class="panel-heading">
        <h1>Appearance</h1>
        <p>Customize the look and feel of CodeSync.</p>
      </div>

      <div class="setting-card">
        <div class="setting-card-title">Theme</div>
        <div class="setting-card-desc">Choose your preferred color scheme.</div>
        <div class="theme-grid">
          ${themeOptions.map(t => `
            <label class="theme-option" title="${t.label} theme">
              <input type="radio" name="theme" value="${t.val}" ${appearance.theme === t.val ? 'checked' : ''} />
              <div class="theme-box">
                <div class="theme-preview" style="background:${t.bg};"></div>
                <div class="theme-name">${t.label}</div>
              </div>
            </label>`).join('')}
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-title">Accent Color</div>
        <div class="setting-card-desc">Sets the primary highlight color across the UI.</div>
        <div class="accent-grid">
          ${accentOptions.map(a => `
            <label class="accent-option" title="${a.label}">
              <input type="radio" name="accent" value="${a.val}" ${appearance.accent === a.val ? 'checked' : ''} />
              <div class="accent-swatch" style="background:${a.color};--swatch-color:${a.color};" aria-label="${a.label} accent"></div>
            </label>`).join('')}
        </div>
      </div>
    </div>`;
}

function buildPlatformsPanel(): string {
  return `
    <div class="tab-panel${activeTab === 'platforms' ? ' active' : ''}" id="panel-platforms" role="tabpanel" aria-labelledby="tab-platforms">
      <div class="panel-heading">
        <h1>Platforms</h1>
        <p>Enable the coding platforms you want to sync from.</p>
      </div>
      <div class="setting-card">
        <div class="setting-card-title">Enabled Platforms</div>
        <div class="setting-card-desc">The floating sync button will appear on enabled platforms when you have an accepted solution.</div>
        <div class="platform-grid">
          ${PLATFORM_OPTIONS.map(p => {
            const enabled = settings.enabledPlatforms[p.key as keyof typeof settings.enabledPlatforms] ?? false;
            return `
              <label class="platform-card${enabled ? ' enabled' : ''}" for="platform-${p.key}" title="${enabled ? 'Disable' : 'Enable'} ${p.label}">
                <input type="checkbox" id="platform-${p.key}" name="platform-${p.key}" ${enabled ? 'checked' : ''} />
                <div class="platform-icon">${p.icon}</div>
                <div class="platform-info">
                  <div class="platform-name">${p.label}</div>
                  <div class="platform-status">${enabled ? 'Enabled' : 'Disabled'}</div>
                </div>
                <div class="platform-check" aria-hidden="true">${enabled ? I.check : ''}</div>
              </label>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function buildRepositoryPanel(): string {
  return `
    <div class="tab-panel${activeTab === 'repository' ? ' active' : ''}" id="panel-repository" role="tabpanel" aria-labelledby="tab-repository">
      <div class="panel-heading">
        <h1>Repository</h1>
        <p>Configure where your solutions are committed.</p>
      </div>

      <div class="setting-card">
        <div class="setting-card-title">Target Repository</div>
        <div class="setting-card-desc">The GitHub repository where accepted solutions will be pushed.</div>
        <div class="field-grid">
          <div class="field">
            <label for="repo-input">Repository</label>
            <input id="repo-input" name="repository" type="text"
                   value="${escHtml(settings.repository || '')}"
                   placeholder="owner/repository-name" />
            <div class="field-hint">Format: username/repo-name</div>
          </div>
          <div class="field">
            <label for="branch-input">Branch</label>
            <input id="branch-input" name="branch" type="text"
                   value="${escHtml(settings.branch || 'main')}"
                   placeholder="main" />
          </div>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-title">Commit Template</div>
        <div class="setting-card-desc">Template for commit messages. Use <code style="font-family:'JetBrains Mono',monospace;font-size:0.8em;background:rgba(99,142,255,0.1);padding:1px 5px;border-radius:4px;">{title}</code> as a placeholder.</div>
        <div class="field">
          <label for="commit-template">Template</label>
          <input id="commit-template" name="commitTemplate" type="text"
                 value="${escHtml(settings.commitTemplate || 'Solved {title}')}"
                 placeholder="Solved {title}" />
          <div class="field-hint" id="commit-preview">Preview: ${escHtml((settings.commitTemplate || 'Solved {title}').replace('{title}', 'Two Sum'))}</div>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-title">File Behavior</div>
        <div class="setting-card-desc">How to handle files when a solution already exists in the repository.</div>
        <div class="field">
          <label for="overwrite-select">Overwrite behavior</label>
          <select id="overwrite-select" name="overwriteBehavior">
            <option value="skip"      ${settings.overwriteBehavior === 'skip'      ? 'selected' : ''}>Skip — Don't overwrite existing files</option>
            <option value="overwrite" ${settings.overwriteBehavior === 'overwrite' ? 'selected' : ''}>Overwrite — Replace with latest solution</option>
            <option value="versioned" ${settings.overwriteBehavior === 'versioned' ? 'selected' : ''}>Versioned — Append timestamp suffix</option>
          </select>
        </div>
      </div>
    </div>`;
}

function buildSyncPanel(): string {
  const rows: Array<{ name: keyof SyncSettings; label: string; desc: string }> = [
    { name: 'autoSync',         label: 'Auto Sync',          desc: 'Automatically sync when an accepted solution is detected' },
    { name: 'notifications',    label: 'Notifications',       desc: 'Show browser notifications for sync events' },
    { name: 'duplicateDetection', label: 'Prevent Duplicates', desc: 'Skip syncing if the same solution was already committed' },
    { name: 'retryFailedSync',  label: 'Retry on Failure',   desc: 'Automatically retry failed sync attempts once' },
    { name: 'offlineQueue',     label: 'Offline Queue',       desc: 'Queue syncs when offline and retry when connected' },
    { name: 'autoMetadata',     label: 'Generate Metadata',  desc: 'Create a metadata.json file for each solution' },
    { name: 'autoReadme',       label: 'Generate README',    desc: 'Create a README.md file with the problem description' },
  ];

  return `
    <div class="tab-panel${activeTab === 'sync' ? ' active' : ''}" id="panel-sync" role="tabpanel" aria-labelledby="tab-sync">
      <div class="panel-heading">
        <h1>Sync</h1>
        <p>Control how and when solutions are synced.</p>
      </div>
      <div class="setting-card">
        ${rows.map(row => {
          const val = settings[row.name];
          const checked = Boolean(val);
          return `
            <div class="toggle-row">
              <div class="toggle-info">
                <div class="toggle-label">${row.label}</div>
                <div class="toggle-desc">${row.desc}</div>
              </div>
              <label class="toggle-switch" title="${row.label}">
                <input type="checkbox" name="${row.name}" ${checked ? 'checked' : ''} aria-label="${row.label}" />
                <span class="toggle-track"></span>
              </label>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function buildContactPanel(): string {
  const contacts = [
    { icon: I.github,    label: 'GitHub',    color: '#e8edf8', bg: '#161b22', href: 'https://github.com/orpheusdark' },
    { icon: I.mail,      label: 'Email',     color: '#e8edf8', bg: '#1a1a2e', href: 'mailto:contact@orpheusdark.dev' },
    { icon: I.linkedin,  label: 'LinkedIn',  color: '#0a66c2', bg: '#0a1929', href: 'https://linkedin.com/in/orpheusdark' },
    { icon: I.portfolio, label: 'Portfolio', color: '#a78bfa', bg: '#1a0f2e', href: 'https://orpheusdark.dev' },
    { icon: I.discord,   label: 'Discord',   color: '#5865f2', bg: '#0d1117', href: 'https://discord.gg/orpheusdark' },
    { icon: I.twitter,   label: 'Twitter/X', color: '#e8edf8', bg: '#15202b', href: 'https://x.com/orpheusdark' },
    { icon: I.globe,     label: 'Website',   color: '#34d399', bg: '#0a1f0f', href: 'https://orpheusdark.dev' },
  ];

  return `
    <div class="tab-panel${activeTab === 'contact' ? ' active' : ''}" id="panel-contact" role="tabpanel" aria-labelledby="tab-contact">
      <div class="panel-heading">
        <h1>Contact</h1>
        <p>Get in touch or follow along on social media.</p>
      </div>
      <div class="setting-card">
        <div class="setting-card-title">Find me online</div>
        <div class="setting-card-desc">Reach out with feedback, feature requests, or just to say hi!</div>
        <div class="social-grid">
          ${contacts.map(c => `
            <a class="social-btn" href="${c.href}" target="_blank" rel="noopener noreferrer" aria-label="${c.label}">
              <div class="social-icon" style="background:${c.bg};color:${c.color};">${c.icon}</div>
              ${c.label}
            </a>`).join('')}
        </div>
      </div>
      <div class="setting-card" style="margin-top: 16px;">
        <div class="setting-card-title">Support & Issues</div>
        <div class="setting-card-desc">Having Issues? Report a bug or request a feature on our GitHub repository.</div>
        <a href="https://github.com/orpheusdark/code-sync-extension/issues/new" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; width: auto; text-decoration: none; width: 100%;">
          ${I.github} Report a bug
        </a>
      </div>
    </div>`;
}

function buildSharePanel(): string {
  const shareUrl = 'https://github.com/orpheusdark/code-sync-extension';
  const shareText = encodeURIComponent('🚀 CodeSync — Automatically sync your LeetCode & GFG solutions to GitHub! #coding #github');
  const shareUrlEnc = encodeURIComponent(shareUrl);

  const shareOptions = [
    { icon: I.copy,     label: 'Copy Link',  id: 'btn-copy-link',  href: '#' },
    { icon: I.twitter,  label: 'Tweet',      id: '',               href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrlEnc}` },
    { icon: I.linkedin, label: 'LinkedIn',   id: '',               href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrlEnc}` },
    { icon: '🟠',       label: 'Reddit',     id: '',               href: `https://reddit.com/submit?url=${shareUrlEnc}&title=CodeSync+Extension` },
    { icon: '💬',       label: 'WhatsApp',   id: '',               href: `https://wa.me/?text=${shareText}%20${shareUrlEnc}` },
    { icon: '✈️',       label: 'Telegram',   id: '',               href: `https://t.me/share/url?url=${shareUrlEnc}&text=${shareText}` },
  ];

  return `
    <div class="tab-panel${activeTab === 'share' ? ' active' : ''}" id="panel-share" role="tabpanel" aria-labelledby="tab-share">
      <div class="panel-heading">
        <h1>Share</h1>
        <p>Spread the word and help other developers discover CodeSync.</p>
      </div>
      <div class="setting-card">
        <div class="setting-card-title">Share CodeSync</div>
        <div class="setting-card-desc">Know someone who'd love automatic GitHub syncing? Share it with them!</div>
        <div class="share-grid">
          ${shareOptions.map(s => {
            const isEmoji = typeof s.icon === 'string' && !s.icon.includes('<svg');
            const iconHtml = isEmoji
              ? `<span style="font-size:1.1rem;">${s.icon}</span>`
              : s.icon;
            if (s.id === 'btn-copy-link') {
              return `<button class="share-btn" id="btn-copy-link" aria-label="Copy share link">${iconHtml} ${s.label}</button>`;
            }
            return `<a class="share-btn" href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="Share on ${s.label}">${iconHtml} ${s.label}</a>`;
          }).join('')}
        </div>
        <div id="copy-feedback" style="font-size:0.78rem;color:var(--ag);margin-top:10px;opacity:0;transition:opacity 200ms ease;">✓ Link copied to clipboard!</div>
      </div>
    </div>`;
}

function buildAboutPanel(): string {
  const version = '1.2';
  return `
    <div class="tab-panel${activeTab === 'about' ? ' active' : ''}" id="panel-about" role="tabpanel" aria-labelledby="tab-about">
      <div class="panel-heading">
        <h1>About</h1>
        <p>Information about this extension and its components.</p>
      </div>
      <div class="setting-card">
        <div class="setting-card-title">Extension Info</div>
        <div class="about-grid">
          <div class="about-row">
            <span class="about-row-label">Version</span>
            <span class="about-row-value">v${version}</span>
          </div>
          <div class="about-row">
            <span class="about-row-label">Extension Status</span>
            <span class="status-pill green">
              <span style="width:6px;height:6px;border-radius:50%;background:var(--ag);display:inline-block;"></span>
              Active
            </span>
          </div>
          <div class="about-row">
            <span class="about-row-label">Backend Status</span>
            <span id="backend-status" class="status-pill green">
              <span style="width:6px;height:6px;border-radius:50%;background:var(--ag);display:inline-block;"></span>
              Available
            </span>
          </div>
          <div class="about-row">
            <span class="about-row-label">License</span>
            <span class="about-row-value">All Rights Reserved</span>
          </div>
          <div class="about-row">
            <span class="about-row-label">Author</span>
            <span class="about-row-value">orpheusdark</span>
          </div>
        </div>
        <a class="oss-badge" href="https://github.com/orpheusdark/code-sync-extension" target="_blank" rel="noopener noreferrer">
          ${I.github}
          Open Source on GitHub — Star ⭐ if you like it!
        </a>
      </div>
      <div class="setting-card">
        <div class="setting-card-title">Release Notes</div>
        <div class="setting-card-desc">v${version} — Initial release</div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          ${[
            '✓ LeetCode accepted solution sync',
            '✓ GeeksforGeeks sync support',
            '✓ GitHub OAuth device flow authentication',
            '✓ Draggable floating sync button',
            '✓ Repository and branch selection',
            '✓ Duplicate detection',
            '✓ Premium glassmorphism UI',
          ].map(note => `
            <div style="display:flex;align-items:center;gap:8px;font-size:0.83rem;color:var(--t2);">
              <span style="color:var(--ag);flex-shrink:0;">${I.check}</span>
              ${note.replace('✓ ', '')}
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ================================================================
// FULL PAGE RENDER
// ================================================================
function render(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const html = `
    <div class="site-header">
      <div class="site-logo-group">
        <img class="logo-mark" src="icons/icon32.png" alt="" width="28" height="28" />
        <div class="site-logo">CodeSync</div>
      </div>
      <div class="site-header-div" aria-hidden="true"></div>
      <div class="site-header-title">Settings</div>
      <div class="site-header-spacer"></div>
      <div class="saved-badge" id="saved-badge" aria-live="polite">${I.check} Saved</div>
      <div class="site-version">v1.2</div>
    </div>

    <div class="main-layout">
      ${buildSidebar()}

      <main class="content" role="main">
        <form id="settings-form" novalidate>
          ${buildAppearancePanel()}
          ${buildPlatformsPanel()}
          ${buildRepositoryPanel()}
          ${buildSyncPanel()}
          ${buildContactPanel()}
          ${buildSharePanel()}
          ${buildAboutPanel()}
        </form>
      </main>
    </div>

    <div class="save-footer" role="contentinfo">
      <button type="submit" form="settings-form" class="btn-save" id="btn-save">Save Changes</button>
      <button type="button" class="btn-discard" id="btn-discard">Discard</button>
    </div>
  `;
  setHTML(app, html);

  applyAppearance(appearance);
  bindEvents();
  checkBackendStatus();
}

// ================================================================
// EVENTS
// ================================================================
function bindEvents(): void {
  // Tab switching
  const tabIds: TabId[] = ['appearance', 'platforms', 'repository', 'sync', 'contact', 'share', 'about'];
  for (const id of tabIds) {
    document.getElementById(`tab-${id}`)?.addEventListener('click', () => switchTab(id));
  }

  // Appearance: theme radio
  document.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach(input => {
    input.addEventListener('change', () => {
      appearance.theme = input.value as AppearanceSettings['theme'];
      applyAppearance(appearance);
      void saveAppearance();
    });
  });

  // Appearance: accent radio
  document.querySelectorAll<HTMLInputElement>('input[name="accent"]').forEach(input => {
    input.addEventListener('change', () => {
      appearance.accent = input.value as AppearanceSettings['accent'];
      applyAccent(appearance.accent);
      void saveAppearance();
    });
  });

  // Platform toggles: live update card styling
  document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][id^="platform-"]').forEach(input => {
    input.addEventListener('change', () => {
      const card = input.closest('.platform-card');
      const statusEl = card?.querySelector('.platform-status');
      const checkEl = card?.querySelector('.platform-check');
      if (input.checked) {
        card?.classList.add('enabled');
        if (statusEl) statusEl.textContent = 'Enabled';
        if (checkEl) setHTML(checkEl, I.check);
      } else {
        card?.classList.remove('enabled');
        if (statusEl) statusEl.textContent = 'Disabled';
        if (checkEl) checkEl.textContent = '';
      }
    });
  });

  // Commit template live preview
  const templateInput = document.getElementById('commit-template') as HTMLInputElement | null;
  const previewEl = document.getElementById('commit-preview');
  templateInput?.addEventListener('input', () => {
    if (previewEl) {
      previewEl.textContent = `Preview: ${templateInput.value.replace('{title}', 'Two Sum') || 'Solved Two Sum'}`;
    }
  });

  // Form submission
  document.getElementById('settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSave();
  });

  // Discard
  document.getElementById('btn-discard')?.addEventListener('click', () => {
    void loadData().then(() => {
      applyAppearance(appearance);
      render();
    });
  });

  // Copy link
  document.getElementById('btn-copy-link')?.addEventListener('click', () => {
    void navigator.clipboard.writeText('https://github.com/orpheusdark/code-sync-extension').then(() => {
      const el = document.getElementById('copy-feedback');
      if (el) {
        el.style.opacity = '1';
        setTimeout(() => { if (el) el.style.opacity = '0'; }, 2500);
      }
    });
  });
}

function switchTab(id: TabId): void {
  activeTab = id;

  // Update sidebar buttons
  document.querySelectorAll<HTMLElement>('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  const activeBtn = document.getElementById(`tab-${id}`);
  activeBtn?.classList.add('active');
  activeBtn?.setAttribute('aria-selected', 'true');

  // Switch visible panel
  document.querySelectorAll<HTMLElement>('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const panel = document.getElementById(`panel-${id}`);
  if (panel) {
    panel.classList.add('active');
    // Reset animation
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
  }
}

// ================================================================
// SAVE
// ================================================================
async function handleSave(): Promise<void> {
  const form = document.getElementById('settings-form') as HTMLFormElement | null;
  if (!form) return;
  const data = new FormData(form);

  const updated: SyncSettings = {
    ...settings,
    repository: String(data.get('repository') ?? '').trim(),
    branch: String(data.get('branch') ?? 'main').trim() || 'main',
    commitTemplate: String(data.get('commitTemplate') ?? 'Solved {title}').trim() || 'Solved {title}',
    autoSync: data.get('autoSync') === 'on',
    notifications: data.get('notifications') === 'on',
    duplicateDetection: data.get('duplicateDetection') === 'on',
    retryFailedSync: data.get('retryFailedSync') === 'on',
    offlineQueue: data.get('offlineQueue') === 'on',
    autoMetadata: data.get('autoMetadata') === 'on',
    autoReadme: data.get('autoReadme') === 'on',
    overwriteBehavior: (data.get('overwriteBehavior') as SyncSettings['overwriteBehavior']) || 'skip',
    enabledPlatforms: PLATFORM_OPTIONS.reduce((acc, p) => ({
      ...acc,
      [p.key]: data.get(`platform-${p.key}`) === 'on'
    }), { ...DEFAULT_SETTINGS.enabledPlatforms }),
  };

  await saveState(STORAGE_KEYS.SETTINGS, updated);
  settings = updated;

  // Flash saved badge
  showSavedBadge();
}

async function saveAppearance(): Promise<void> {
  await saveState(APPEARANCE_KEY, appearance);
  applyAppearance(appearance);
}

function showSavedBadge(): void {
  const badge = document.getElementById('saved-badge');
  if (!badge) return;
  badge.classList.add('show');
  if (savedFlashTimer) clearTimeout(savedFlashTimer);
  savedFlashTimer = setTimeout(() => {
    badge?.classList.remove('show');
  }, 2200);
}

// ================================================================
// BACKEND PING
// ================================================================
async function checkBackendStatus(): Promise<void> {
  const el = document.getElementById('backend-status');
  if (!el) return;
  try {
    const res = await fetch('https://code-sync-extension-backend.onrender.com/health', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      el.className = 'status-pill green';
      setHTML(el, `<span style="width:6px;height:6px;border-radius:50%;background:var(--ag);display:inline-block;"></span> Online`);
    } else {
      throw new Error('not ok');
    }
  } catch {
    el.className = 'status-pill yellow';
    setHTML(el, `<span style="width:6px;height:6px;border-radius:50%;background:#fbbf24;display:inline-block;"></span> Unavailable`);
  }
}

// ================================================================
// DATA LOADING
// ================================================================
async function loadData(): Promise<void> {
  const [rawSettings, rawAppearance] = await Promise.all([
    loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
    loadState<AppearanceSettings>(APPEARANCE_KEY, DEFAULT_APPEARANCE),
  ]);
  settings = normalizeSettings(rawSettings);
  appearance = { ...DEFAULT_APPEARANCE, ...rawAppearance };
}

// ================================================================
// INIT
// ================================================================
void loadData().then(() => {
  applyAppearance(appearance);
  render();
});
