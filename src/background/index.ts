import { MESSAGE_TYPES } from '../shared/messages';
import { loadState, saveState } from '../shared/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import type { GitHubAuthState, SubmissionPayload, SyncDebugState, SyncSettings } from '../shared/types';
import { syncSubmissionToGitHub } from './services/sync';
import { showNotification } from './services/notifications';
import { authenticateWithGitHub } from './github/oauth';
import { clearGitHubAuth, getGitHubBranches, getGitHubProfile, getGitHubRepositories } from './github/api';

async function saveSyncDebugState(nextState: SyncDebugState): Promise<void> {
  await saveState(STORAGE_KEYS.SYNC_DEBUG, nextState);
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
        await showNotification(result.message);
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
        await showNotification(`Sync failed: ${messageText}`);
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
