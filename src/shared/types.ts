/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
export type Platform = 'leetcode' | 'gfg' | 'hackerrank' | 'codingninjas';

export type EnabledPlatformKey = Platform | 'codeforces' | 'atcoder' | 'codechef';


export interface EnabledPlatforms {
  leetcode: boolean;
  gfg: boolean;
  hackerrank: boolean;
  codingninjas: boolean;
  codeforces: boolean;
  atcoder: boolean;
  codechef: boolean;
}

export interface SyncSettings {
  repository: string;
  branch: string;
  autoSync: boolean;
  commitTemplate: string;
  notifications: boolean;
  overwriteBehavior: 'skip' | 'overwrite' | 'versioned';
  enabledPlatforms: EnabledPlatforms;
  autoMetadata?: boolean;
  autoReadme?: boolean;
  retryFailedSync?: boolean;
  duplicateDetection?: boolean;
  offlineQueue?: boolean;
}

export interface SubmissionPayload {
  platform: Platform;
  title: string;
  slug: string;
  language: string;
  code: string;
  difficulty?: string;
  url: string;
  tags?: string[];
  submittedAt?: string;
  source?: string;
  problemId?: string;
  problemNumber?: string;
  runtime?: string;
  memory?: string;
}

export interface GitHubProfile {
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  html_url?: string;
  type?: string;
}

export interface GitHubRepository {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  description?: string;
}

export interface GitHubBranch {
  name: string;
}

export interface GitHubAuthState {
  token?: string;
  username?: string;
  authenticated: boolean;
  connectedAt?: string;
  profile?: GitHubProfile;
}

export type SyncDebugStatus = 'idle' | 'detected' | 'syncing' | 'success' | 'error';

export interface SyncDebugState {
  status: SyncDebugStatus;
  updatedAt: string;
  source?: string;
  repository?: string;
  branch?: string;
  problemId?: string;
  title?: string;
  language?: string;
  message?: string;
}

export interface SyncStats {
  totalSynced: number;
  leetcodeSynced: number;
  gfgSynced: number;
  hackerrankSynced: number;
  codingninjasSynced: number;
  repositoriesConnected: string[];
  lastSync?: string;
}
