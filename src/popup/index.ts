import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import { loadState, saveState } from '../shared/storage';
import { MESSAGE_TYPES } from '../shared/messages';
import type { GitHubAuthState, GitHubBranch, GitHubRepository, SyncDebugState, SyncSettings } from '../shared/types';

const app = document.getElementById('app');
let statusMessage = '';
let authCode = '';
let lastPolledAuthState = '';
let lastRenderedDebugState = '';

async function persistSettings(partial: Partial<SyncSettings>): Promise<void> {
  const currentSettings = await loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  await saveState(STORAGE_KEYS.SETTINGS, { ...currentSettings, ...partial });
}

function formatTime(value?: string): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString();
}

function setRepoLoadMessage(message: string): void {
  const messageElement = document.getElementById('repoLoadMessage');
  if (!messageElement) return;

  messageElement.textContent = message;
  messageElement.style.display = message ? 'block' : 'none';
}

async function loadBranchesForRepository(repository: string, selectedBranch = ''): Promise<void> {
  const branchSelect = document.getElementById('branch') as HTMLSelectElement | null;
  if (!branchSelect) return;

  if (!repository) {
    branchSelect.innerHTML = '<option value="">Select branch</option>';
    return;
  }

  branchSelect.innerHTML = '<option value="">Loading branches...</option>';
  try {
    const branches = await new Promise<GitHubBranch[]>((resolve) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_BRANCHES, repository }, (response) => resolve(response || []));
    });

    if (!Array.isArray(branches) || branches.length === 0) {
      branchSelect.innerHTML = '<option value="">No branches found</option>';
      return;
    }

    const selected = selectedBranch || branches[0]?.name || '';
    branchSelect.innerHTML = '<option value="">Select branch</option>' + branches.map((branch) => `<option value="${branch.name}" ${selected === branch.name ? 'selected' : ''}>${branch.name}</option>`).join('');
  } catch {
    branchSelect.innerHTML = '<option value="">Unable to load branches</option>';
  }
}

async function render(): Promise<void> {
  if (!app) return;
  const settings = await loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
  const syncDebug = await loadState<SyncDebugState | null>(STORAGE_KEYS.SYNC_DEBUG, null);
  const profile = auth.profile;
  const isConnected = Boolean(auth.authenticated && auth.token);

  app.innerHTML = `
    <div class="panel hero">
      <div>
        <div class="chip">● Connected</div>
        <h2 style="margin: 6px 0 4px;">CodeSync</h2>
        <div class="muted">Auto-sync accepted solutions to GitHub</div>
      </div>
      <div>${isConnected && profile?.avatar_url ? `<img class="avatar" src="${profile.avatar_url}" alt="avatar" />` : '<div class="chip">Offline</div>'}</div>
    </div>

    ${isConnected ? `
      <div class="panel">
        <div class="row">
          <div>
            <div style="font-weight:700;">${profile?.name || profile?.login || 'GitHub User'}</div>
            <div class="muted">@${profile?.login || 'github-user'}</div>
          </div>
          <div class="chip">Verified</div>
        </div>
      </div>
      <div class="panel grid">
        <div>
          <div class="muted">Repository</div>
          <div class="stat">${settings.repository || 'Select a repo'}</div>
        </div>
        <div>
          <div class="muted">Branch</div>
          <div class="stat">${settings.branch || 'main'}</div>
        </div>
        <div>
          <div class="muted">Auto sync</div>
          <div class="stat">${settings.autoSync ? 'Enabled' : 'Disabled'}</div>
        </div>
      </div>
      <div class="panel">
        <label for="repo">Repository</label>
        <select id="repo">
          <option value="">Select repository</option>
        </select>
        <div id="repoLoadMessage" class="muted" style="margin-top:6px;color:#ff6b6b;display:none;"></div>
        <input id="repoManual" type="text" placeholder="owner/repo" style="margin-top:8px;width:100%;" value="${settings.repository || ''}" />
        <label for="branch" style="margin-top:8px;">Branch</label>
        <select id="branch">
          <option value="">Select branch</option>
        </select>
        <div class="row" style="margin-top:10px;">
          <button id="save">Save</button>
        </div>
      </div>
      <div class="panel">
        <div class="row">
          <span>Auto commit</span>
          <input type="checkbox" id="autoSync" ${settings.autoSync ? 'checked' : ''} />
        </div>
      </div>
      <div class="panel">
        <div class="row">
          <div style="font-weight:700;">Sync Debug</div>
          <button id="refreshDebug" class="secondary">Refresh</button>
        </div>
        <div class="muted" style="margin-top:8px;">Status: ${syncDebug?.status || 'idle'}</div>
        <div class="muted">Updated: ${formatTime(syncDebug?.updatedAt)}</div>
        <div class="muted">Problem: ${syncDebug?.problemId || 'N/A'}${syncDebug?.title ? ` - ${syncDebug.title}` : ''}</div>
        <div class="muted">Repo: ${syncDebug?.repository || settings.repository || 'N/A'}${syncDebug?.branch ? ` (${syncDebug.branch})` : ''}</div>
        <div class="muted">Source: ${syncDebug?.source || 'N/A'}</div>
        <div class="muted" style="margin-top:6px;color:${syncDebug?.status === 'error' ? '#ff6b6b' : '#94a3b8'};">${syncDebug?.message || 'No sync attempts yet.'}</div>
      </div>
    ` : `
      <div class="panel">
        <h3 style="margin-top:0;">Continue with GitHub</h3>
        <p class="muted">Connect your GitHub account to sync accepted solutions. The local backend must be running and the OAuth app must be configured.</p>
        ${statusMessage ? `<div class="muted" style="margin-bottom:8px;color:${statusMessage.startsWith('Error') ? '#ff6b6b' : '#2ecc71'};">${statusMessage}</div>` : ''}
        ${authCode ? `<div style="margin-bottom:8px;padding:8px;border:1px solid #2ecc71;border-radius:8px;font-weight:700;letter-spacing:0.2em;text-align:center;">${authCode}</div>` : ''}
        <button id="login" style="width:100%;">Continue with GitHub</button>
      </div>
    `}

    <div class="panel row">
      <button id="settings" class="secondary">Settings</button>
      ${auth.authenticated ? '<button id="logout" class="secondary">Disconnect</button>' : ''}
    </div>
  `;

  document.getElementById('settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('refreshDebug')?.addEventListener('click', async () => {
    await render();
  });

  document.getElementById('save')?.addEventListener('click', async () => {
    const repo = ((document.getElementById('repo') as HTMLSelectElement | null)?.value || (document.getElementById('repoManual') as HTMLInputElement | null)?.value || '').trim();
    const branch = (document.getElementById('branch') as HTMLSelectElement | null)?.value ?? '';
    const autoSync = (document.getElementById('autoSync') as HTMLInputElement | null)?.checked ?? settings.autoSync;
    const nextSettings = { ...settings, repository: repo, branch, autoSync };
    await saveState(STORAGE_KEYS.SETTINGS, nextSettings);
    await render();
  });

  document.getElementById('repo')?.addEventListener('change', (event) => {
    const repo = (event.currentTarget as HTMLSelectElement).value.trim();
    const repoManual = document.getElementById('repoManual') as HTMLInputElement | null;
    if (repoManual) {
      repoManual.value = repo;
    }
    void persistSettings({ repository: repo, branch: '' });
    void loadBranchesForRepository(repo);
  });

  document.getElementById('repoManual')?.addEventListener('change', (event) => {
    const repo = (event.currentTarget as HTMLInputElement).value.trim();
    void persistSettings({ repository: repo, branch: '' });
    void loadBranchesForRepository(repo);
  });

  document.getElementById('branch')?.addEventListener('change', (event) => {
    const branch = (event.currentTarget as HTMLSelectElement).value.trim();
    void persistSettings({ branch });
  });

  document.getElementById('autoSync')?.addEventListener('change', (event) => {
    const autoSync = (event.currentTarget as HTMLInputElement).checked;
    void persistSettings({ autoSync });
  });

  document.getElementById('login')?.addEventListener('click', async () => {
    statusMessage = 'Starting GitHub sign-in...';
    authCode = '';
    await render();
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.LOGIN }, async (response) => {
      const result = response && typeof response === 'object' ? response : {};
      if (result.ok && result.code) {
        statusMessage = 'Open GitHub and enter the code below.';
        authCode = String(result.code);
        await render();
      } else if (result.ok) {
        statusMessage = 'GitHub connected successfully.';
        authCode = '';
        await render();
      } else {
        statusMessage = `Error: ${result.message || 'Unable to sign in with GitHub.'}`;
        await render();
      }

      const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
      if (auth.authenticated && auth.token) {
        statusMessage = 'GitHub connected successfully.';
        authCode = '';
        await render();
      }
    });
  });

  document.getElementById('logout')?.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.LOGOUT }, async () => {
      await render();
    });
  });

  if (isConnected) {
    void loadRepositoryAndBranchOptions(settings);
  }
}

async function loadRepositoryAndBranchOptions(settings: SyncSettings): Promise<void> {
  const repoSelect = document.getElementById('repo') as HTMLSelectElement | null;
  const repoManual = document.getElementById('repoManual') as HTMLInputElement | null;
  if (!repoSelect) return;

  setRepoLoadMessage('');
  try {
    const repos = await new Promise<GitHubRepository[]>((resolve) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_REPOSITORIES }, (response) => resolve(response || []));
    });

    if (!Array.isArray(repos) || repos.length === 0) {
      repoSelect.innerHTML = '<option value="">Select repository</option>';
      setRepoLoadMessage('No repositories were returned for this account. You can enter a repository manually.');
      if (repoManual && !repoManual.value) {
        repoManual.value = settings.repository || '';
      }
      await loadBranchesForRepository('');
      return;
    }

    repoSelect.innerHTML = '<option value="">Select repository</option>' + repos.map((repo) => `<option value="${repo.full_name}" ${settings.repository === repo.full_name ? 'selected' : ''}>${repo.full_name}</option>`).join('');

    if (settings.repository && repoManual) {
      repoManual.value = settings.repository;
    }
    await loadBranchesForRepository(settings.repository, settings.branch);
  } catch {
    repoSelect.innerHTML = '<option value="">Unable to load repositories</option>';
    setRepoLoadMessage('Repositories could not be loaded. You can enter a repository manually.');
    if (repoManual && !repoManual.value) {
      repoManual.value = settings.repository || '';
    }
    await loadBranchesForRepository('');
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MESSAGE_TYPES.AUTH_SUCCESS) {
    statusMessage = message.payload?.message || 'GitHub connected successfully.';
    authCode = '';
    void render();
  }

  if (message?.type === MESSAGE_TYPES.AUTH_FAILED) {
    statusMessage = `Error: ${message.payload?.message || 'Unable to sign in with GitHub.'}`;
    authCode = '';
    void render();
  }
});

setInterval(() => {
  void (async () => {
    const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
    const currentAuthState = `${auth.authenticated ? '1' : '0'}:${auth.token || ''}`;
    const syncDebug = await loadState<SyncDebugState | null>(STORAGE_KEYS.SYNC_DEBUG, null);
    const currentDebugState = JSON.stringify(syncDebug || {});
    if (currentAuthState === lastPolledAuthState && currentDebugState === lastRenderedDebugState) {
      return;
    }
    lastPolledAuthState = currentAuthState;
    lastRenderedDebugState = currentDebugState;

    if (auth.authenticated && auth.token && !statusMessage.startsWith('Error')) {
      statusMessage = 'GitHub connected successfully.';
      authCode = '';
    }
    await render();
  })();
}, 2000);

void render();
