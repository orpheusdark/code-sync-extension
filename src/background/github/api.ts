import { STORAGE_KEYS } from '../../shared/constants';
import { CONFIG } from '../../shared/config';
import { saveState } from '../../shared/storage';
import type { GitHubAuthState, GitHubBranch, GitHubProfile, GitHubRepository } from '../../shared/types';

export async function verifyGitHubToken(token: string): Promise<GitHubAuthState> {
  const response = await fetch(`${CONFIG.API_BASE_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('GitHub authentication expired or invalid.');
  }

  const data = await response.json() as GitHubProfile;
  const state: GitHubAuthState = {
    token,
    username: data.login,
    authenticated: true,
    connectedAt: new Date().toISOString(),
    profile: data
  };

  await saveState(STORAGE_KEYS.AUTH, state);
  return state;
}

export async function getGitHubProfile(token: string): Promise<GitHubProfile> {
  const response = await fetch(`${CONFIG.API_BASE_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error('Unable to load GitHub profile.');
  return response.json() as Promise<GitHubProfile>;
}

export async function getGitHubRepositories(token: string): Promise<GitHubRepository[]> {
  const response = await fetch(`${CONFIG.API_BASE_URL}/repos`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error('Unable to load repositories.');
  return response.json() as Promise<GitHubRepository[]>;
}

export async function getGitHubBranches(token: string, repository: string): Promise<GitHubBranch[]> {
  const response = await fetch(`${CONFIG.API_BASE_URL}/branches/${encodeURIComponent(repository)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) throw new Error('Unable to load branches.');
  return response.json() as Promise<GitHubBranch[]>;
}

export async function clearGitHubAuth(): Promise<void> {
  await saveState(STORAGE_KEYS.AUTH, { authenticated: false });
}
