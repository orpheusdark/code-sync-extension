export const DEFAULT_SETTINGS: SyncSettings = {
  repository: '',
  branch: 'main',
  autoSync: true,
  commitTemplate: 'Solved {title}',
  notifications: true,
  overwriteBehavior: 'skip'
};

export const STORAGE_KEYS = {
  SETTINGS: 'codesync.settings',
  AUTH: 'codesync.auth',
  LAST_SYNC: 'codesync.lastSync',
  SYNC_DEBUG: 'codesync.syncDebug',
  LAST_SUBMISSION: 'codesync.lastSubmission'
};
