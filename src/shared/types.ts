export type Platform = 'leetcode';

export interface SyncSettings {
  repository: string;
  branch: string;
  autoSync: boolean;
  commitTemplate: string;
  notifications: boolean;
  overwriteBehavior: 'skip' | 'overwrite' | 'versioned';
  autoMetadata?: boolean;
  autoReadme?: boolean;
  retryFailedSync?: boolean;
  duplicateDetection?: boolean;
  offlineQueue?: boolean;
}

export interface SubmissionPayload {
  platform: Platform;
  problemId: string;
  problemNumber?: string;
  problemSlug?: string;
  title: string;
  difficulty: string;
  language: string;
  code: string;
  runtime?: string;
  memory?: string;
  tags: string[];
  url: string;
  submittedAt: string;
  source: string;
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
