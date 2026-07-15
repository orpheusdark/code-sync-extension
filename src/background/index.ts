/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import { MESSAGE_TYPES } from '../shared/messages';
import { loadState, saveState } from '../shared/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import type { GitHubAuthState, SubmissionPayload, SyncDebugState, SyncSettings, SyncStats } from '../shared/types';
import { syncSubmissionToGitHub } from './services/sync';
import { showNotification } from './services/notifications';
import { authenticateWithGitHub, cancelDeviceAuthorization } from './github/oauth';
import { clearGitHubAuth, getGitHubBranches, getGitHubProfile, getGitHubRepositories } from './github/api';
import { addHistoryItem } from './services/history';
import { addToOfflineQueue, getOfflineQueue, incrementRetryCount, removeFromOfflineQueue } from './services/queue';

async function saveSyncDebugState(nextState: SyncDebugState): Promise<void> {
  await saveState(STORAGE_KEYS.SYNC_DEBUG, nextState);
}

async function updateSyncStats(submission: SubmissionPayload): Promise<void> {
  const currentStats = await loadState<SyncStats>(STORAGE_KEYS.SYNC_STATS, {
    totalSynced: 0,
    leetcodeSynced: 0,
    gfgSynced: 0,
    hackerrankSynced: 0,
    repositoriesConnected: []
  });

  const repository = (await loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)).repository;
  const repositoriesConnected = repository && !currentStats.repositoriesConnected.includes(repository)
    ? currentStats.repositoriesConnected
    : repository
      ? [...currentStats.repositoriesConnected, repository]
      : currentStats.repositoriesConnected;

  await saveState(STORAGE_KEYS.SYNC_STATS, {
    totalSynced: currentStats.totalSynced + 1,
    leetcodeSynced: currentStats.leetcodeSynced + (submission.platform === 'leetcode' ? 1 : 0),
    gfgSynced: currentStats.gfgSynced + (submission.platform === 'gfg' ? 1 : 0),
    hackerrankSynced: (currentStats.hackerrankSynced ?? 0) + (submission.platform === 'hackerrank' ? 1 : 0),
    repositoriesConnected,
    lastSync: new Date().toISOString()
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (message.type === MESSAGE_TYPES.SYNC_SUBMISSION) {
      const submission = message.payload as SubmissionPayload;
      await saveState(STORAGE_KEYS.LAST_SUBMISSION, submission);
      const settings = await loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
      await saveSyncDebugState({
        status: 'detected',
        updatedAt: new Date().toISOString(),
        source: submission.source,
        repository: settings.repository,
        branch: settings.branch || 'main',
        problemId: submission.problemId,
        title: submission.title,
        language: submission.language,
        message: 'Submission detected. Preparing sync.'
      });

      if (!settings.repository) {
        await saveSyncDebugState({
          status: 'error',
          updatedAt: new Date().toISOString(),
          source: submission.source,
          repository: settings.repository,
          branch: settings.branch || 'main',
          problemId: submission.problemId,
          title: submission.title,
          language: submission.language,
          message: 'Repository is not configured yet.'
        });
        await showNotification('Repository is not configured yet.');
        sendResponse({ ok: false, reason: 'missing-repository' });
        return;
      }

      try {
        await saveSyncDebugState({
          status: 'syncing',
          updatedAt: new Date().toISOString(),
          source: submission.source,
          repository: settings.repository,
          branch: settings.branch || 'main',
          problemId: submission.problemId,
          title: submission.title,
          language: submission.language,
          message: 'Sync in progress...'
        });

        const result = await syncSubmissionToGitHub(submission, settings);
        await saveState(STORAGE_KEYS.LAST_SYNC, Date.now());
        await saveState(STORAGE_KEYS.LAST_SYNCED_SUBMISSION, submission);
        await updateSyncStats(submission);
        await saveSyncDebugState({
          status: 'success',
          updatedAt: new Date().toISOString(),
          source: submission.source,
          repository: settings.repository,
          branch: settings.branch || 'main',
          problemId: submission.problemId,
          title: submission.title,
          language: submission.language,
          message: result.message
        });
        await addHistoryItem({
          platform: submission.platform,
          title: submission.title,
          language: submission.language,
          repository: settings.repository,
          branch: settings.branch || 'main',
          status: result.status === 'duplicate' ? 'duplicate' : 'success',
          retryCount: 0,
          url: result.url
        });
        await showNotification(`✓ ${submission.title} synced successfully.`);
        sendResponse({ ok: true, result });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Unknown error';
        await saveSyncDebugState({
          status: 'error',
          updatedAt: new Date().toISOString(),
          source: submission.source,
          repository: settings.repository,
          branch: settings.branch || 'main',
          problemId: submission.problemId,
          title: submission.title,
          language: submission.language,
          message: messageText
        });
        
        await addToOfflineQueue(submission, messageText);
        await addHistoryItem({
          platform: submission.platform,
          title: submission.title,
          language: submission.language,
          repository: settings.repository || '',
          branch: settings.branch || 'main',
          status: 'failed',
          retryCount: 0,
          message: messageText
        });
        
        await showNotification('Unable to sync. Added to offline queue.');
        sendResponse({ ok: false, reason: messageText });
      }
      return;
    }

    if (message.type === MESSAGE_TYPES.LOGIN) {
      const authResult = await authenticateWithGitHub();
      sendResponse(authResult);
      return;
    }

    if (message.type === MESSAGE_TYPES.LOGOUT) {
      cancelDeviceAuthorization();
      await clearGitHubAuth();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_PROFILE) {
      const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
      if (!auth.token) {
        sendResponse(null);
        return;
      }
      const profile = await getGitHubProfile(auth.token);
      sendResponse(profile);
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_REPOSITORIES) {
      const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
      if (!auth.token) {
        sendResponse([]);
        return;
      }
      const repos = await getGitHubRepositories(auth.token);
      sendResponse(repos);
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_BRANCHES) {
      const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
      if (!auth.token || !message.repository) {
        sendResponse([]);
        return;
      }
      const branches = await getGitHubBranches(auth.token, message.repository);
      sendResponse(branches);
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void saveState(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
});

// Process offline queue
async function processOfflineQueue() {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  const settings = await loadState<SyncSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  if (!settings.repository) return;
  if (!navigator.onLine) return; // Still offline

  for (const item of queue) {
    if (item.retryCount >= 3) {
      await removeFromOfflineQueue(item.id);
      continue;
    }

    try {
      const result = await syncSubmissionToGitHub(item.payload, settings);
      
      await addHistoryItem({
        platform: item.payload.platform,
        title: item.payload.title,
        language: item.payload.language,
        repository: settings.repository,
        branch: settings.branch || 'main',
        status: result.status === 'duplicate' ? 'duplicate' : 'success',
        retryCount: item.retryCount + 1,
        url: result.url
      });
      await showNotification(`✓ ${item.payload.title} synced successfully from queue.`);
      await removeFromOfflineQueue(item.id);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      await incrementRetryCount(item.id, errorMsg);
      if (item.retryCount + 1 >= 3) {
        await removeFromOfflineQueue(item.id);
        await showNotification(`✗ Failed to sync ${item.payload.title} after 3 retries.`);
      }
    }
  }
}

// Background startup validation and queue processing
chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    // Attempt to process queue
    await processOfflineQueue();

    // Validate token silently
    const auth = await loadState<GitHubAuthState>(STORAGE_KEYS.AUTH, { authenticated: false });
    if (auth.token) {
      try {
        await getGitHubProfile(auth.token);
      } catch {
        // Token invalid, clear it
        await clearGitHubAuth();
      }
    }
  })();
});

// Listen for network reconnect
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('online', () => {
    void processOfflineQueue();
  });
}

// Set up periodic alarm to process queue
chrome.alarms.create('processOfflineQueue', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'processOfflineQueue') {
    void processOfflineQueue();
  }
});

