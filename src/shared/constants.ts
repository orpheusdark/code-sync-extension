/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import type { SyncSettings } from './types';

export const DEFAULT_SETTINGS: SyncSettings = {
  repository: '',
  branch: 'main',
  autoSync: false,
  commitTemplate: 'Solved {title}',
  notifications: true,
  overwriteBehavior: 'skip',
  enabledPlatforms: {
    leetcode: true,
    gfg: true,
    hackerrank: true,
    codeforces: false,
    atcoder: false,
    codechef: false,
    codingninjas: true
  },
  duplicateDetection: true
};


export const STORAGE_KEYS = {
  SETTINGS: 'codesync.settings',
  AUTH: 'codesync.auth',
  LAST_SYNC: 'codesync.lastSync',
  SYNC_DEBUG: 'codesync.syncDebug',
  LAST_SUBMISSION: 'codesync.lastSubmission',
  LAST_SYNCED_SUBMISSION: 'codesync.lastSyncedSubmission',
  SYNC_STATS: 'codesync.syncStats',
  FLOATING_BUTTON_POSITION: 'codesync.floatingButtonPosition',
  PENDING_DEVICE_AUTH: 'codesync.pendingDeviceAuth',
  SYNC_HISTORY: 'codesync.syncHistory',
  OFFLINE_QUEUE: 'codesync.offlineQueue',
  SETUP_COMPLETE: 'codesync.setupComplete'
};
