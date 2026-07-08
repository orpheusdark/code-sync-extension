export const DEFAULT_SETTINGS: SyncSettings = {
  repository: '',
  branch: 'main',
  autoSync: true,
  commitTemplate: 'Solved {title}',
  notifications: true,
  overwriteBehavior: 'skip',
  enabledPlatforms: {
    leetcode: true,
    gfg: true,
    hackerrank: false,
    codeforces: false,
    atcoder: false,
    codechef: false
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
  PENDING_DEVICE_AUTH: 'codesync.pendingDeviceAuth'
};
