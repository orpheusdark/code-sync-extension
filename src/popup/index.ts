/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { APPEARANCE_KEY, applyAppearance, DEFAULT_APPEARANCE, type AppearanceSettings } from '../shared/appearance';
import { MESSAGE_TYPES } from '../shared/messages';
import { loadState, saveState } from '../shared/storage';
import type { GitHubAuthState, GitHubBranch, GitHubRepository, SyncSettings, SyncStats, SyncHistoryItem } from '../shared/types';
import { setHTML } from '../shared/dom';

const app = document.getElementById('app')!;

// ================================================================
// STATE
// ================================================================
interface PopupState {
  view: 'home' | 'repo-picker' | 'branch-picker';
  statusMessage: string;
  statusVariant: 'info' | 'error' | 'success';
  authCode: string;
  verificationUriComplete: string;
  repositories: GitHubRepository[];
  branches: GitHubBranch[];
  repoQuery: string;
  branchQuery: string;
  loadingRepos: boolean;
  loadingBranches: boolean;
  settings: SyncSettings;
  auth: GitHubAuthState;
  syncStats: SyncStats;
  syncHistory: SyncHistoryItem[];
  showLogoutConfirm: boolean;
  appearance: AppearanceSettings;
  setupComplete: boolean;
  setupStep: number;
}

const state: PopupState = {
  view: 'home',
  statusMessage: '',
  statusVariant: 'info',
  authCode: '',
  verificationUriComplete: '',
  repositories: [],
  branches: [],
  repoQuery: '',
  branchQuery: '',
  loadingRepos: false,
  loadingBranches: false,
  settings: DEFAULT_SETTINGS,
  auth: { authenticated: false },
  syncStats: { totalSynced: 0, leetcodeSynced: 0, gfgSynced: 0, hackerrankSynced: 0, codingninjasSynced: 0, repositoriesConnected: [] },
  syncHistory: [],
  showLogoutConfirm: false,
  appearance: DEFAULT_APPEARANCE,
  setupComplete: true, // defaults to true, updated in loadData
  setupStep: 1,
};

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

function formatRelativeTime(value?: string): string {
  if (!value) return 'Never';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return 'Unknown';
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function getEffectiveTheme(): 'light' | 'dark' {
  const theme = state.appearance.theme;
  if (theme === 'light') return 'light';
  if (theme === 'dark' || theme === 'oled') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

async function toggleTheme(): Promise<void> {
  const nextTheme = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
  state.appearance = { ...state.appearance, theme: nextTheme };
  applyAppearance(state.appearance);
  await saveState(APPEARANCE_KEY, state.appearance);
  render();
}

function sendRuntimeMessage<T>(message: unknown): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      if (!chrome.runtime?.id) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve((response ?? null) as T | null);
      });
    } catch {
      resolve(null);
    }
  });
}

// ================================================================
// SVG ICONS
// ================================================================
const I = {
  github: `<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.08.55-.17.55-.38v-1.3c-2.22.48-2.69-1.06-2.69-1.06-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.53.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .22.15.47.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`,
  githubLg: `<svg width="26" height="26" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.08.55-.17.55-.38v-1.3c-2.22.48-2.69-1.06-2.69-1.06-.36-.92-.89-1.16-.89-1.16-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.53.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .22.15.47.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`,
  settings: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.05 1.05M11.85 11.85l1.05 1.05M3.1 12.9l1.05-1.05M11.85 4.15l1.05-1.05"/></svg>`,
  repo: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z"/><path d="M5 7h6M5 10h4"/></svg>`,
  branch: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="4" cy="3" r="1.5"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="5.5" r="1.5"/><path d="M4 4.5v7M4 4.5Q12 5.5 12 5.5"/></svg>`,
  home: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z"/><path d="M6 15V9h4v6"/></svg>`,
  power: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M8 2v5M5.2 3.9A5 5 0 1 0 10.8 3.9"/></svg>`,
  edit: `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 2.5a1.41 1.41 0 0 1 2 2L5 13l-3 1 1-3Z"/></svg>`,
  external: `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h4v4M6 10l8-8"/><path d="M7 4H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>`,
  back: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>`,
  sync: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 0 1 9.67-3.58"/><path d="M12 3v2.5h-2.5"/><path d="M13.5 8A5.5 5.5 0 0 1 3.83 11.58"/><path d="M4 13v-2.5h2.5"/></svg>`,
  launch: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="4.5" width="13" height="10" rx="1.5"/><path d="M1.5 8h13M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5"/></svg>`,
  refresh: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 6.5A5.5 5.5 0 0 0 2.5 8"/><path d="M13 4v3h-3"/><path d="M2.5 9.5A5.5 5.5 0 0 0 13.5 8"/><path d="M3 12V9H6"/></svg>`,
  lock: `<svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C5.8 0 4 1.8 4 4v1H2v10h12V5h-2V4c0-2.2-1.8-4-4-4Zm0 2c1.1 0 2 .9 2 2v1H6V4c0-1.1.9-2 2-2Zm0 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>`,
  globe: `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 2s-2 2.5-2 6 2 6 2 6M8 2s2 2.5 2 6-2 6-2 6M2 8h12"/></svg>`,
  star: `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5l1.85 3.75 4.15.6-3 2.92.7 4.13L8 10.77l-3.7 1.93.7-4.13L2 5.85l4.15-.6Z"/></svg>`,
  sun: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/></svg>`,
  moon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 9.3A5.5 5.5 0 0 1 6.7 2.5 5.5 5.5 0 1 0 13.5 9.3Z"/></svg>`,
};

// ================================================================
// HTML BUILDERS
// ================================================================
function buildHeader(): string {
  const connected = Boolean(state.auth.authenticated && state.auth.token);
  const themeIcon = getEffectiveTheme() === 'dark' ? I.sun : I.moon;
  const themeLabel = getEffectiveTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return `
    <div class="hdr">
      <div class="logo-group">
        <img class="logo-mark" src="icons/icon32.png" alt="" width="28" height="28" />
        <span class="logo-text">CodeSync</span>
      </div>
      <div class="hdr-right">
        <div class="status-badge">
          <span class="status-dot ${connected ? 'on' : 'off'}"></span>
          ${connected ? 'Connected' : 'Offline'}
        </div>
        <button class="icon-btn theme-toggle" id="btn-theme-toggle" title="${themeLabel}" aria-label="${themeLabel}">
          ${themeIcon}
        </button>
      </div>
    </div>`;
}

function buildProfileCard(): string {
  const { auth, syncStats } = state;
  if (!auth.authenticated) return '';
  const { profile } = auth;
  const lastSync = formatRelativeTime(syncStats.lastSync);
  const avatarHtml = profile?.avatar_url
    ? `<div class="avatar-ring"><img class="avatar" src="${escHtml(profile.avatar_url)}" alt="${escHtml(profile.login ?? '')}" /></div>`
    : `<div class="avatar-placeholder">${I.githubLg}</div>`;
  return `
    <div class="profile-card" id="profile-link" role="button" tabindex="0" title="Open GitHub profile" aria-label="Open GitHub profile for ${escHtml(profile?.login ?? 'user')}">
      ${avatarHtml}
      <div class="profile-info">
        <div class="profile-name">${escHtml(profile?.login ?? 'GitHub User')}</div>
        <div class="profile-sub">Last sync ${lastSync}</div>
      </div>
      <span style="color:var(--t3);">${I.external}</span>
    </div>`;
}

function buildRepoCard(): string {
  const repo = state.settings.repository || 'Not configured';
  return `
    <div class="info-card">
      <div class="info-icon">${I.repo}</div>
      <div class="info-body">
        <div class="info-lbl">Repository</div>
        <div class="info-val" title="${escHtml(repo)}">${escHtml(repo)}</div>
      </div>
      <button class="edit-btn" id="btn-edit-repo" title="Change repository" aria-label="Change repository">
        ${I.edit}
      </button>
    </div>`;
}

function buildBranchCard(): string {
  const branch = state.settings.branch || 'main';
  return `
    <div class="info-card">
      <div class="info-icon">${I.branch}</div>
      <div class="info-body">
        <div class="info-lbl">Branch</div>
        <div class="info-val">${escHtml(branch)}</div>
      </div>
      <button class="edit-btn" id="btn-edit-branch" title="Change branch" aria-label="Change branch">
        ${I.edit}
      </button>
    </div>`;
}

function buildCommitHistory(): string {
  if (state.syncHistory.length === 0) {
    return `
      <div class="section-label">Sync History</div>
      <div class="coming-soon" aria-label="No sync history yet">
        <div class="cs-badge">${I.star} Empty</div>
        <div class="cs-title">No Syncs Yet</div>
        <div class="cs-desc">Your synced submissions will appear here.</div>
      </div>`;
  }

  const itemsHtml = state.syncHistory.slice(0, 5).map(item => {
    const time = formatRelativeTime(item.timestamp);
    const success = item.status === 'success' || item.status === 'duplicate';
    const statusColor = success ? 'var(--ag)' : 'var(--ar)';
    const statusIcon = success ? I.check : I.power; // using power for error since I don't have an error icon

    return `
      <div style="background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
        <div style="width:28px;height:28px;border-radius:8px;background:var(--accent-soft);color:var(--a1);display:flex;align-items:center;justify-content:center;flex-shrink:0;text-transform:uppercase;font-size:0.65rem;font-weight:700;">
          ${item.platform.slice(0, 2)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.85rem;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(item.title)}">
            ${escHtml(item.title)}
          </div>
          <div style="font-size:0.7rem;color:var(--t3);display:flex;align-items:center;gap:6px;">
            <span>${escHtml(item.language)}</span>
            <span>&bull;</span>
            <span>${time}</span>
          </div>
        </div>
        <div style="color:${statusColor};" title="${escHtml(item.status)}">
          ${statusIcon}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section-label" style="display:flex;justify-content:space-between;">
      <span style="display:flex;align-items:center;gap:8px;">Sync History</span>
    </div>
    <div style="margin-top:8px;">
      ${itemsHtml}
    </div>`;
}

function buildNavDock(): string {
  const isHome = state.view === 'home';
  const connected = Boolean(state.auth.authenticated && state.auth.token);

  return `
    <nav class="nav-dock" role="navigation" aria-label="Main navigation">
      <button class="nav-btn${isHome ? ' active' : ''}" id="nav-home" aria-label="Home" title="Home">
        ${I.home}
        Home
      </button>
      <button class="nav-btn" id="nav-settings" aria-label="Settings" title="Settings">
        ${I.settings}
        Settings
      </button>
      ${connected ? `
      <button class="nav-btn" id="nav-github" aria-label="GitHub" title="GitHub">
        ${I.github}
        GitHub
      </button>
      <button class="nav-btn danger" id="nav-disconnect" aria-label="Disconnect from GitHub" title="Disconnect">
        ${I.power}
        Logout
      </button>` : ''}
    </nav>`;
}

function buildLogoutConfirm(): string {
  return `
    <div class="confirm-overlay" id="logout-overlay" role="dialog" aria-modal="true" aria-label="Confirm disconnect">
      <div class="confirm-dialog">
        <div class="confirm-icon" aria-hidden="true">${I.power}</div>
        <div class="confirm-title">Disconnect GitHub?</div>
        <div class="confirm-desc">You'll be signed out and syncing will pause until you reconnect.</div>
        <div class="confirm-btns">
          <button class="btn-secondary" id="cancel-logout">Cancel</button>
          <button class="btn-danger" id="confirm-logout">Disconnect</button>
        </div>
      </div>
    </div>`;
}

function buildStatusMessage(): string {
  if (!state.statusMessage) return '';
  const cls = state.statusVariant === 'error' ? ' error' : state.statusVariant === 'success' ? ' success' : '';
  return `<div class="status-msg${cls}" role="status">${escHtml(state.statusMessage)}</div>`;
}

function buildAuthCode(): string {
  if (!state.authCode) return '';
  return `
    <div class="auth-code-card">
      <div class="auth-code-label">Your GitHub device code</div>
      <div class="auth-code" id="auth-code-value" aria-label="Authentication code: ${state.authCode}">${escHtml(state.authCode)}</div>
      <div class="auth-code-hint">
        <strong>Step 1:</strong> Copy this code.<br />
        <strong>Step 2:</strong> Open GitHub and approve CodeSync.<br />
        Keep this popup open until connection completes.
      </div>
      <div class="auth-code-actions">
        <button class="btn-secondary auth-code-copy" id="btn-copy-device-code" type="button">Copy Code</button>
        <button class="btn-primary auth-code-open" id="btn-open-device" type="button">Open GitHub &amp; Authorize</button>
      </div>
    </div>`;
}

// ================================================================
// PAGE LAYOUTS
// ================================================================
function buildConnectedHome(): string {
  return `
    ${buildHeader()}
    ${buildProfileCard()}
    <div class="section-label">Repository</div>
    ${buildRepoCard()}
    ${buildBranchCard()}
    ${buildCommitHistory()}
    ${buildStatusMessage()}
    ${state.showLogoutConfirm ? buildLogoutConfirm() : ''}
    <div style="text-align: center; margin-bottom: 8px;">
      <a href="https://github.com/orpheusdark/code-sync-extension/issues/new" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: var(--t2); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: color 200ms ease;" onmouseover="this.style.color='var(--a1)'" onmouseout="this.style.color='var(--t2)'">
        Having Issues? <span style="color: var(--a1); font-weight: 600;">Report a bug</span>
      </a>
    </div>
    ${buildNavDock()}`;
}

function buildDisconnectedHome(): string {
  return `
    ${buildHeader()}
    <div class="connect-card">
      <div class="connect-icon">${I.githubLg}</div>
      <div class="connect-title">Connect GitHub</div>
      <div class="connect-desc">Sign in with GitHub in one click. If redirect sign-in is unavailable on this machine, CodeSync falls back to a device code shown here.</div>
      <button class="btn-primary" id="btn-login">
        ${I.github}
        Continue with GitHub
      </button>
    </div>
    ${buildStatusMessage()}
    ${buildAuthCode()}
    <div style="text-align: center; margin-top: 10px; margin-bottom: 8px;">
      <a href="https://github.com/orpheusdark/code-sync-extension/issues/new" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: var(--t2); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; transition: color 200ms ease;" onmouseover="this.style.color='var(--a1)'" onmouseout="this.style.color='var(--t2)'">
        Having Issues? <span style="color: var(--a1); font-weight: 600;">Report a bug</span>
      </a>
    </div>
    ${buildNavDock()}`;
}

function buildSetupWizard(): string {
  if (state.setupStep === 1) {
    if (state.auth.authenticated && state.auth.token) {
      setTimeout(() => { state.setupStep = 2; render(); }, 0);
      return ``;
    }
    return `
      ${buildHeader()}
      <div style="padding:10px;text-align:center;">
        <h2 style="font-family:'Pirata One';font-size:1.4rem;color:var(--t1);">Welcome to CodeSync</h2>
        <p style="font-size:0.85rem;color:var(--t2);margin-bottom:15px;">Step 1: Connect your GitHub account</p>
        <button class="btn-primary" id="btn-login" style="margin-bottom:10px;">
          ${I.github} Continue with GitHub
        </button>
        ${buildStatusMessage()}
        ${buildAuthCode()}
      </div>`;
  }
  
  if (state.setupStep === 2) {
    return `
      ${buildHeader()}
      <div style="padding:10px;text-align:center;">
        <h2 style="font-family:'Pirata One';font-size:1.4rem;color:var(--t1);">Repository Setup</h2>
        <p style="font-size:0.85rem;color:var(--t2);margin-bottom:15px;">Step 2: Choose where to sync your code</p>
        
        ${state.settings.repository ? `
          ${buildRepoCard()}
          ${buildBranchCard()}
          <button class="btn-primary" id="btn-finish-setup" style="margin-top:15px;">
            Finish Setup
          </button>
        ` : `
          <button class="btn-primary" id="btn-select-repo" style="margin-bottom:10px;">
            ${I.repo} Select Repository
          </button>
        `}
      </div>`;
  }

  return '';
}

function buildRepoPicker(): string {
  const query = state.repoQuery.toLowerCase();
  const filtered = state.repositories.filter(r =>
    r.full_name.toLowerCase().includes(query)
  );

  let listHtml: string;
  if (state.loadingRepos) {
    listHtml = `<div class="picker-empty">Loading repositories…</div>`;
  } else if (filtered.length === 0) {
    listHtml = `<div class="picker-empty">No repositories found</div>`;
  } else {
    listHtml = filtered.map(repo => {
      const selected = state.settings.repository === repo.full_name;
      return `
        <div class="picker-item${selected ? ' selected' : ''}" data-repo="${escHtml(repo.full_name)}" data-branch="${escHtml(repo.default_branch)}" role="option" aria-selected="${selected}" tabindex="0">
          <div style="min-width:0;flex:1;">
            <div class="picker-item-name">${escHtml(repo.full_name)}</div>
            ${repo.description ? `<div class="picker-item-desc">${escHtml(repo.description)}</div>` : ''}
          </div>
          <div class="picker-item-meta">
            ${repo.private ? I.lock + ' Private' : I.globe + ' Public'}
            ${selected ? `<span style="color:var(--a1);margin-left:4px;">${I.check}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  return `
    ${buildHeader()}
    <div class="glass-card">
      <div class="picker-hdr">
        <button class="icon-btn" id="btn-back" aria-label="Back to home">${I.back}</button>
        <div class="picker-title">Select Repository</div>
      </div>
      <div class="search-bar">
        ${I.search}
        <input id="repo-search" type="text" placeholder="Search repositories…" value="${escHtml(state.repoQuery)}" autocomplete="off" aria-label="Search repositories" />
      </div>
      <div class="picker-list" id="repo-list" role="listbox" aria-label="Repository list">
        ${listHtml}
      </div>
    </div>
    ${buildNavDock()}`;
}

function buildBranchPicker(): string {
  const query = state.branchQuery.toLowerCase();
  const filtered = state.branches.filter(b =>
    b.name.toLowerCase().includes(query)
  );

  let listHtml: string;
  if (state.loadingBranches) {
    listHtml = `<div class="picker-empty">Loading branches…</div>`;
  } else if (filtered.length === 0) {
    listHtml = `<div class="picker-empty">No branches found</div>`;
  } else {
    listHtml = filtered.map(branch => {
      const selected = state.settings.branch === branch.name;
      return `
        <div class="picker-item${selected ? ' selected' : ''}" data-branch="${escHtml(branch.name)}" role="option" aria-selected="${selected}" tabindex="0">
          <div class="picker-item-name" style="display:flex;align-items:center;gap:6px;">
            ${I.branch} ${escHtml(branch.name)}
          </div>
          ${selected ? `<span style="color:var(--a1);">${I.check}</span>` : ''}
        </div>`;
    }).join('');
  }

  return `
    ${buildHeader()}
    <div class="glass-card">
      <div class="picker-hdr">
        <button class="icon-btn" id="btn-back" aria-label="Back to home">${I.back}</button>
        <div class="picker-title">Select Branch</div>
      </div>
      <div class="search-bar">
        ${I.search}
        <input id="branch-search" type="text" placeholder="Search branches…" value="${escHtml(state.branchQuery)}" autocomplete="off" aria-label="Search branches" />
      </div>
      <div class="picker-list" role="listbox" aria-label="Branch list">
        ${listHtml}
      </div>
    </div>
    ${buildNavDock()}`;
}

// ================================================================
// RENDER
// ================================================================
function render(): void {
  let html: string;

  if (!state.setupComplete) {
    if (state.view === 'repo-picker') html = buildRepoPicker();
    else if (state.view === 'branch-picker') html = buildBranchPicker();
    else html = buildSetupWizard();
  } else if (state.view === 'repo-picker') {
    html = buildRepoPicker();
  } else if (state.view === 'branch-picker') {
    html = buildBranchPicker();
  } else {
    const connected = Boolean(state.auth.authenticated && state.auth.token);
    html = connected ? buildConnectedHome() : buildDisconnectedHome();
  }

  setHTML(app, html);

  // Trigger entrance animation
  app.classList.remove('view-enter');
  void app.offsetWidth; // reflow
  app.classList.add('view-enter');

  // Bind events for the current view
  if (!state.setupComplete && state.view === 'home') {
    bindSetupWizardEvents();
  } else if (state.view === 'repo-picker') {
    bindRepoPickerEvents();
  } else if (state.view === 'branch-picker') {
    bindBranchPickerEvents();
  } else {
    bindHomeEvents();
  }
}

// ================================================================
// EVENT BINDING — SETUP WIZARD
// ================================================================
function bindSetupWizardEvents(): void {
  document.getElementById('btn-login')?.addEventListener('click', () => {
    void handleLogin();
  });

  document.getElementById('btn-copy-device-code')?.addEventListener('click', () => {
    void copyDeviceCode();
  });

  document.getElementById('btn-open-device')?.addEventListener('click', () => {
    const url = state.verificationUriComplete || 'https://github.com/login/device';
    void chrome.tabs.create({ url });
  });

  document.getElementById('btn-select-repo')?.addEventListener('click', () => {
    void openRepoPicker();
  });

  document.getElementById('btn-edit-repo')?.addEventListener('click', () => {
    void openRepoPicker();
  });

  document.getElementById('btn-edit-branch')?.addEventListener('click', () => {
    void openBranchPicker();
  });

  document.getElementById('btn-finish-setup')?.addEventListener('click', async () => {
    state.setupComplete = true;
    await saveState(STORAGE_KEYS.SETUP_COMPLETE, true);
    render();
  });
}

// ================================================================
// COMMON NAV BINDING (shared across views)
// ================================================================
function bindCommonNav(): void {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    void toggleTheme();
  });
  document.getElementById('nav-home')?.addEventListener('click', () => {
    state.view = 'home';
    state.showLogoutConfirm = false;
    render();
  });
  document.getElementById('nav-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById('nav-github')?.addEventListener('click', () => {
    const login = state.auth.profile?.login;
    void chrome.tabs.create({ url: login ? `https://github.com/${login}` : 'https://github.com' });
  });
  document.getElementById('nav-disconnect')?.addEventListener('click', () => {
    if (!state.auth.authenticated) return;
    state.view = 'home';
    state.showLogoutConfirm = true;
    render();
  });
}

// ================================================================
// EVENT BINDING — HOME
// ================================================================
function bindHomeEvents(): void {
  bindCommonNav();

  // Profile → open GitHub
  const profileCard = document.getElementById('profile-link');
  profileCard?.addEventListener('click', () => {
    const url = state.auth.profile?.html_url;
    if (url) void chrome.tabs.create({ url });
  });
  profileCard?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      profileCard.click();
    }
  });

  // Repo edit
  document.getElementById('btn-edit-repo')?.addEventListener('click', () => {
    void openRepoPicker();
  });

  // Branch edit
  document.getElementById('btn-edit-branch')?.addEventListener('click', () => {
    void openBranchPicker();
  });

  // Login
  document.getElementById('btn-login')?.addEventListener('click', () => {
    void handleLogin();
  });

  document.getElementById('btn-copy-device-code')?.addEventListener('click', () => {
    void copyDeviceCode();
  });

  document.getElementById('btn-open-device')?.addEventListener('click', () => {
    const url = state.verificationUriComplete || 'https://github.com/login/device';
    void chrome.tabs.create({ url });
  });

  // Logout confirm
  document.getElementById('cancel-logout')?.addEventListener('click', () => {
    state.showLogoutConfirm = false;
    render();
  });
  document.getElementById('confirm-logout')?.addEventListener('click', () => {
    void handleLogout();
  });
  document.getElementById('logout-overlay')?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === e.currentTarget) { state.showLogoutConfirm = false; render(); }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown, { once: true });
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    void openRepoPicker();
  }
  if (e.key === 'Escape' && state.showLogoutConfirm) {
    state.showLogoutConfirm = false;
    render();
  }
}

// ================================================================
// EVENT BINDING — REPO PICKER
// ================================================================
function bindRepoPickerEvents(): void {
  if (state.setupComplete) {
    bindCommonNav();
  }

  document.getElementById('btn-back')?.addEventListener('click', () => {
    state.view = 'home';
    state.repoQuery = '';
    render();
  });

  const searchInput = document.getElementById('repo-search') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    state.repoQuery = searchInput.value;
    updateRepoList();
  });
  searchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') { state.view = 'home'; state.repoQuery = ''; render(); }
  });
  setTimeout(() => searchInput?.focus(), 60);

  bindRepoItems();
}

function updateRepoList(): void {
  const list = document.getElementById('repo-list');
  if (!list) return;
  const query = state.repoQuery.toLowerCase();
  const filtered = state.repositories.filter(r => r.full_name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    setHTML(list, `<div class="picker-empty">No repositories found</div>`);
    return;
  }

  setHTML(list, filtered.map(repo => {
    const selected = state.settings.repository === repo.full_name;
    return `
      <div class="picker-item${selected ? ' selected' : ''}" data-repo="${escHtml(repo.full_name)}" data-branch="${escHtml(repo.default_branch)}" role="option" aria-selected="${selected}" tabindex="0">
        <div style="min-width:0;flex:1;">
          <div class="picker-item-name">${escHtml(repo.full_name)}</div>
          ${repo.description ? `<div class="picker-item-desc">${escHtml(repo.description)}</div>` : ''}
        </div>
        <div class="picker-item-meta">
          ${repo.private ? I.lock + ' Private' : I.globe + ' Public'}
          ${selected ? `<span style="color:var(--a1);margin-left:4px;">${I.check}</span>` : ''}
        </div>
      </div>`;
  }).join(''));

  bindRepoItems();
}

function bindRepoItems(): void {
  document.querySelectorAll<HTMLElement>('.picker-item[data-repo]').forEach(item => {
    const handler = (): void => {
      const repo = item.dataset.repo ?? '';
      const branch = item.dataset.branch ?? 'main';
      if (repo) void selectRepo(repo, branch);
    };
    item.addEventListener('click', handler);
    item.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });
}

// ================================================================
// EVENT BINDING — BRANCH PICKER
// ================================================================
function bindBranchPickerEvents(): void {
  if (state.setupComplete) {
    bindCommonNav();
  }

  document.getElementById('btn-back')?.addEventListener('click', () => {
    state.view = 'home';
    state.branchQuery = '';
    render();
  });

  const searchInput = document.getElementById('branch-search') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    state.branchQuery = searchInput.value;
    render();
    setTimeout(() => {
      const el = document.getElementById('branch-search') as HTMLInputElement | null;
      if (el) { el.value = state.branchQuery; el.focus(); el.setSelectionRange(state.branchQuery.length, state.branchQuery.length); }
    }, 10);
  });
  searchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') { state.view = 'home'; state.branchQuery = ''; render(); }
  });
  setTimeout(() => searchInput?.focus(), 60);

  document.querySelectorAll<HTMLElement>('.picker-item[data-branch]').forEach(item => {
    const handler = (): void => {
      const branch = item.dataset.branch ?? '';
      if (branch) void selectBranch(branch);
    };
    item.addEventListener('click', handler);
    item.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });
}

// ================================================================
// ACTIONS
// ================================================================
async function openRepoPicker(): Promise<void> {
  state.view = 'repo-picker';
  state.loadingRepos = true;
  state.repositories = [];
  render();

  try {
    const repos = await sendRuntimeMessage<GitHubRepository[]>({ type: MESSAGE_TYPES.GET_REPOSITORIES });
    state.repositories = Array.isArray(repos) ? repos : [];
  } catch { state.repositories = []; }

  state.loadingRepos = false;
  render();
}

async function openBranchPicker(): Promise<void> {
  if (!state.settings.repository) {
    state.statusMessage = 'Select a repository first.';
    state.statusVariant = 'error';
    render();
    return;
  }
  state.view = 'branch-picker';
  state.loadingBranches = true;
  state.branches = [];
  render();

  try {
    const branches = await sendRuntimeMessage<GitHubBranch[]>({
      type: MESSAGE_TYPES.GET_BRANCHES,
      repository: state.settings.repository
    });
    state.branches = Array.isArray(branches) ? branches : [];
  } catch { state.branches = []; }

  state.loadingBranches = false;
  render();
}

async function selectRepo(repo: string, defaultBranch: string): Promise<void> {
  const updated: SyncSettings = { ...state.settings, repository: repo, branch: defaultBranch };
  state.settings = updated;
  await saveState(STORAGE_KEYS.SETTINGS, updated);
  state.view = 'home';
  state.repoQuery = '';
  render();
}

async function selectBranch(branch: string): Promise<void> {
  const updated: SyncSettings = { ...state.settings, branch };
  state.settings = updated;
  await saveState(STORAGE_KEYS.SETTINGS, updated);
  state.view = 'home';
  state.branchQuery = '';
  render();
}

function isConnected(): boolean {
  return Boolean(state.auth.authenticated && state.auth.token);
}

let authPollTimer: number | null = null;

function stopAuthPoll(): void {
  if (authPollTimer) {
    window.clearInterval(authPollTimer);
    authPollTimer = null;
  }
}

function startAuthPoll(): void {
  stopAuthPoll();

  if (!state.authCode || isConnected()) {
    return;
  }

  authPollTimer = window.setInterval(() => {
    if (!state.authCode) {
      stopAuthPoll();
      return;
    }

    void loadData().then(() => {
      if (isConnected()) {
        stopAuthPoll();
        void refreshAfterAuthSuccess('GitHub connected successfully.');
      }
    });
  }, 1500);
}

async function refreshAfterAuthSuccess(message: string): Promise<void> {
  state.authCode = '';
  state.verificationUriComplete = '';
  state.statusMessage = message;
  state.statusVariant = 'success';
  state.view = 'home';
  state.showLogoutConfirm = false;
  stopAuthPoll();
  await loadData();
  render();
}

async function copyDeviceCode(): Promise<void> {
  if (!state.authCode) {
    return;
  }

  try {
    await navigator.clipboard.writeText(state.authCode.replace(/\s+/g, '').toUpperCase());
    state.statusMessage = 'Device code copied. Open GitHub and paste it if prompted.';
    state.statusVariant = 'success';
    render();
  } catch {
    state.statusMessage = 'Unable to copy automatically. Select and copy the code manually.';
    state.statusVariant = 'info';
    render();
  }
}

async function handleLogin(): Promise<void> {
  state.statusMessage = 'Opening GitHub sign-in…';
  state.statusVariant = 'info';
  state.authCode = '';
  state.verificationUriComplete = '';
  stopAuthPoll();
  render();

  sendRuntimeMessage<Record<string, unknown>>({ type: MESSAGE_TYPES.LOGIN }).then(async (response) => {
    const result = (response && typeof response === 'object') ? response : {};
    if (result['ok'] && result['pending'] && result['code']) {
      state.statusMessage = String(result['message'] ?? 'Copy the code below, then authorize on GitHub.');
      state.statusVariant = 'info';
      state.authCode = String(result['code']);
      state.verificationUriComplete = String(
        result['verificationUriComplete'] ?? result['verificationUri'] ?? 'https://github.com/login/device'
      );
      startAuthPoll();
    } else if (result['ok']) {
      await refreshAfterAuthSuccess('GitHub connected successfully.');
      return;
    } else {
      state.statusMessage = `Error: ${String(result['message'] ?? 'Unable to sign in with GitHub.')}`;
      state.statusVariant = 'error';
    }
    render();
  });
}

async function handleLogout(): Promise<void> {
  stopAuthPoll();
  await sendRuntimeMessage({ type: MESSAGE_TYPES.LOGOUT });
  state.statusMessage = '';
  state.authCode = '';
  state.verificationUriComplete = '';
  state.showLogoutConfirm = false;
  await loadData();
  render();
}

async function loadData(): Promise<void> {
  const [rawSettings, auth, syncStats, savedAppearance, pendingAuth, syncHistory, setupComplete] = await Promise.all([
    loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
    loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false }),
    loadState<SyncStats>(STORAGE_KEYS.SYNC_STATS, { totalSynced: 0, leetcodeSynced: 0, gfgSynced: 0, hackerrankSynced: 0, codingninjasSynced: 0, repositoriesConnected: [] }),
    loadState<AppearanceSettings>(APPEARANCE_KEY, DEFAULT_APPEARANCE),
    loadState<{ userCode?: string; verificationUriComplete?: string } | null>(STORAGE_KEYS.PENDING_DEVICE_AUTH, null),
    loadState<SyncHistoryItem[]>(STORAGE_KEYS.SYNC_HISTORY, []),
    loadState<boolean>(STORAGE_KEYS.SETUP_COMPLETE, false),
  ]);
  state.settings = normalizeSettings(rawSettings);
  state.auth = auth;
  state.syncStats = syncStats;
  state.syncHistory = syncHistory || [];
  state.appearance = { ...DEFAULT_APPEARANCE, ...savedAppearance };
  state.setupComplete = setupComplete;
  
  if (!state.setupComplete) {
    state.setupStep = (auth.authenticated && auth.token) ? 2 : 1;
  }
  applyAppearance(state.appearance);

  if (!auth.authenticated && pendingAuth?.userCode) {
    state.authCode = pendingAuth.userCode;
    state.verificationUriComplete = pendingAuth.verificationUriComplete || 'https://github.com/login/device';
    if (!state.statusMessage) {
      state.statusMessage = 'Finish GitHub sign-in using the device code below.';
      state.statusVariant = 'info';
    }
    startAuthPoll();
  } else {
    stopAuthPoll();
  }
}

// ================================================================
// HELPER
// ================================================================
function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ================================================================
// MESSAGE LISTENER
// ================================================================
chrome.runtime.onMessage.addListener((message: Record<string, unknown>) => {
  if (message?.['type'] === MESSAGE_TYPES.AUTH_SUCCESS) {
    void refreshAfterAuthSuccess(String(message['payload'] && typeof message['payload'] === 'object'
      ? (message['payload'] as Record<string, unknown>)['message'] ?? 'GitHub connected successfully.'
      : 'GitHub connected successfully.'));
  }
  if (message?.['type'] === MESSAGE_TYPES.AUTH_FAILED) {
    state.statusMessage = `Error: ${String(message['payload'] && typeof message['payload'] === 'object'
      ? (message['payload'] as Record<string, unknown>)['message'] ?? 'Unable to sign in.'
      : 'Unable to sign in.')}`;
    state.statusVariant = 'error';
    render();
  }
});

// ================================================================
// INIT
// ================================================================
async function init(): Promise<void> {
  await loadData();
  render();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    if (changes[STORAGE_KEYS.AUTH]) {
      const nextAuth = changes[STORAGE_KEYS.AUTH].newValue as GitHubAuthState | undefined;
      if (nextAuth?.authenticated && nextAuth.token) {
        void refreshAfterAuthSuccess('GitHub connected successfully.');
        return;
      }
    }

    if (changes[APPEARANCE_KEY]) {
      state.appearance = {
        ...DEFAULT_APPEARANCE,
        ...(changes[APPEARANCE_KEY].newValue as AppearanceSettings | undefined)
      };
      applyAppearance(state.appearance);
      render();
    }
  });
}

void init();