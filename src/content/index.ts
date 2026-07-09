/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import type { SubmissionPayload, SyncSettings } from '../shared/types';
import { detectActivePlatform } from '../platforms/registry';
import type { PlatformAdapter } from '../platforms/types';
import { FloatingSyncButton } from './floating-sync-button';

const MESSAGE_TYPES = {
  SYNC_SUBMISSION: 'SYNC_SUBMISSION'
} as const;

const STORAGE_KEYS = {
  SETTINGS: 'codesync.settings',
  LAST_SYNCED_SUBMISSION: 'codesync.lastSyncedSubmission'
} as const;

const DEFAULT_SETTINGS: SyncSettings = {
  repository: '',
  branch: 'main',
  autoSync: true,
  commitTemplate: 'Solved {title}',
  notifications: true,
  overwriteBehavior: 'skip',
  enabledPlatforms: {
    leetcode: true,
    gfg: true,
    hackerrank: true,
    codeforces: false,
    atcoder: false,
    codechef: false
  },
  duplicateDetection: true
};


type ButtonState = 'idle' | 'loading' | 'success' | 'failure' | 'duplicate';

type SyncResult = {
  ok?: boolean;
  result?: { status?: 'success' | 'duplicate'; message?: string; filePath?: string };
  reason?: string;
};

let syncButton: FloatingSyncButton | null = null;
let activeAdapter: PlatformAdapter | null = null;
let lastRenderedLocation = '';
let refreshTimer: number | null = null;
let pendingRefresh = false;
let mutationObserver: MutationObserver | null = null;
let storageListenerInstalled = false;
let suppressMutationRefresh = false;

function normalizeSettings(settings: SyncSettings): SyncSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    enabledPlatforms: {
      ...DEFAULT_SETTINGS.enabledPlatforms,
      ...(settings.enabledPlatforms || {})
    }
  };
}

async function getSettings(): Promise<SyncSettings> {
  if (!isExtensionContextValid()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return normalizeSettings(result[STORAGE_KEYS.SETTINGS] as SyncSettings | undefined ?? DEFAULT_SETTINGS);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function isButtonInDom(): boolean {
  return Boolean(document.getElementById('codesync-floating-button-host'));
}

function setButtonState(state: ButtonState): void {
  syncButton?.setState(state);
}

function showToast(message: string, variant: 'success' | 'error' | 'duplicate' | 'info' = 'info'): void {
  syncButton?.showToast(message, variant);
}

function resetButtonSoon(): void {
  window.setTimeout(() => {
    if (syncButton && activeAdapter) {
      setButtonState('idle');
    }
  }, 2400);
}

function buildSubmissionSignature(submission: SubmissionPayload): string {
  return [
    submission.platform,
    submission.slug,
    submission.language,
    submission.problemId || '',
    submission.problemNumber || '',
    submission.code.trim()
  ].join('::');
}

async function isAlreadySynced(submission: SubmissionPayload): Promise<boolean> {
  if (!isExtensionContextValid()) {
    return false;
  }

  const settings = await getSettings();
  if (settings.duplicateDetection === false) {
    return false;
  }

  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_SYNCED_SUBMISSION);
    const lastSynced = result[STORAGE_KEYS.LAST_SYNCED_SUBMISSION] as SubmissionPayload | null | undefined;
    if (!lastSynced) {
      return false;
    }

    return buildSubmissionSignature(lastSynced) === buildSubmissionSignature(submission);
  } catch {
    return false;
  }
}

async function syncCurrentSolution(adapter: PlatformAdapter): Promise<void> {
  if (!isExtensionContextValid()) {
    setButtonState('failure');
    showToast('Extension was reloaded. Refresh this page to sync again.', 'error');
    resetButtonSoon();
    return;
  }

  if (!(await adapter.isSubmissionAccepted())) {
    setButtonState('failure');
    showToast('Submit an accepted solution first.', 'error');
    resetButtonSoon();
    return;
  }

  setButtonState('loading');

  try {
    const submission = await adapter.extractSubmission();
    if (!submission) {
      setButtonState('failure');
      showToast('Unable to read the submitted code from this page.', 'error');
      resetButtonSoon();
      return;
    }

    if (await isAlreadySynced(submission)) {
      setButtonState('duplicate');
      showToast('Already synced this accepted submission.', 'duplicate');
      return;
    }

    const response = await sendRuntimeMessage<SyncResult>({ type: MESSAGE_TYPES.SYNC_SUBMISSION, payload: submission });

    if (!response?.ok || !response.result) {
      setButtonState('failure');
      showToast(response?.reason || 'Failed to sync.', 'error');
      resetButtonSoon();
      return;
    }

    if (response.result.status === 'duplicate') {
      setButtonState('duplicate');
      showToast(`${response.result.message || 'Already synced'}\n${response.result.filePath || ''}`, 'duplicate');
      return;
    }

    setButtonState('success');
    showToast(`${response.result.message || 'Synced successfully'}\n${response.result.filePath || ''}`, 'success');
    resetButtonSoon();
  } catch {
    setButtonState('failure');
    showToast('Failed to sync.', 'error');
    resetButtonSoon();
  }
}

function mountButton(adapter: PlatformAdapter): void {
  if (syncButton && activeAdapter?.platform === adapter.platform && isButtonInDom()) {
    activeAdapter = adapter;
    setButtonState('idle');
    syncButton.syncTheme();
    return;
  }

  syncButton?.destroy();
  activeAdapter = adapter;
  adapter.injectSyncButton();

  suppressMutationRefresh = true;
  syncButton = new FloatingSyncButton({
    onClick: () => {
      void syncCurrentSolution(adapter);
    }
  });
  syncButton.mount();
  syncButton.syncTheme();
  setButtonState('idle');
  window.setTimeout(() => {
    suppressMutationRefresh = false;
  }, 300);
}

function unmountButton(): void {
  syncButton?.destroy();
  syncButton = null;
  activeAdapter = null;
}

async function refreshButtonVisibility(): Promise<void> {
  pendingRefresh = false;
  const locationKey = window.location.href;
  const locationChanged = locationKey !== lastRenderedLocation;
  lastRenderedLocation = locationKey;

  const settings = await getSettings();
  const adapter = detectActivePlatform();
  const shouldShow = Boolean(
    adapter && settings.enabledPlatforms[adapter.platform]
  );

  if (!shouldShow) {
    unmountButton();
    return;
  }

  if (syncButton && !isButtonInDom()) {
    syncButton = null;
    activeAdapter = null;
  }

  if (activeAdapter?.platform === adapter!.platform && syncButton) {
    activeAdapter = adapter!;
    if (locationChanged) {
      setButtonState('idle');
    }
    syncButton.syncTheme();
    return;
  }

  mountButton(adapter!);
}

function scheduleRefresh(): void {
  if (pendingRefresh || suppressMutationRefresh) {
    return;
  }

  pendingRefresh = true;

  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }

  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    void refreshButtonVisibility();
  }, 250);
}

function isOwnMutation(mutations: MutationRecord[]): boolean {
  const host = document.getElementById('codesync-floating-button-host');

  return mutations.every((mutation) => {
    if (mutation.type === 'childList') {
      const touchedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (touchedNodes.some((node) => node === host || (node instanceof Element && node.id === 'codesync-floating-button-host'))) {
        return true;
      }
    }

    const target = mutation.target;
    if (!(target instanceof Node)) {
      return false;
    }

    return Boolean(host && (target === host || host.contains(target)));
  });
}

function installNavigationWatcher(): void {
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = pushState.apply(this, args as Parameters<typeof history.pushState>);
    scheduleRefresh();
    return result;
  };

  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args as Parameters<typeof history.replaceState>);
    scheduleRefresh();
    return result;
  };

  window.addEventListener('popstate', scheduleRefresh);
  window.addEventListener('hashchange', scheduleRefresh);
}

function installMutationWatcher(): void {
  if (mutationObserver) {
    return;
  }

  const root = document.body ?? document.documentElement;
  if (!root) {
    return;
  }

  mutationObserver = new MutationObserver((mutations) => {
    if (suppressMutationRefresh || isOwnMutation(mutations)) {
      return;
    }

    scheduleRefresh();
  });

  mutationObserver.observe(root, {
    childList: true,
    subtree: true
  });
}

function sendRuntimeMessage<T>(message: unknown): Promise<T | undefined> {
  return new Promise((resolve) => {
    if (!isExtensionContextValid()) {
      resolve(undefined);
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        void chrome.runtime.lastError;
        resolve(response as T | undefined);
      });
    } catch {
      resolve(undefined);
    }
  });
}

function installStorageWatcher(): void {
  if (storageListenerInstalled) {
    return;
  }

  storageListenerInstalled = true;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!isExtensionContextValid()) {
      return;
    }

    if (areaName !== 'local') {
      return;
    }

    if (changes[STORAGE_KEYS.SETTINGS] || changes[STORAGE_KEYS.LAST_SYNCED_SUBMISSION]) {
      scheduleRefresh();
    }
  });
}

function startObservers(): void {
  installNavigationWatcher();
  installMutationWatcher();
  installStorageWatcher();
}

function boot(): void {
  startObservers();
  void refreshButtonVisibility();
  window.setInterval(() => {
    if (!syncButton || !isButtonInDom()) {
      void refreshButtonVisibility();
    }
  }, 3000);
}

if (document.body) {
  boot();
} else {
  window.addEventListener('DOMContentLoaded', boot, { once: true });
}
