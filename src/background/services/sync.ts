import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../shared/constants';
import { loadState } from '../../shared/storage';
import type { SubmissionPayload, SyncSettings } from '../../shared/types';
import { resolveLanguageExtension } from '../../shared/language-map';

export interface SyncResult {
  ok: boolean;
  message: string;
  url?: string;
  status?: 'success' | 'duplicate';
  filePath?: string;
}

export async function syncSubmissionToGitHub(payload: SubmissionPayload, settings: SyncSettings = DEFAULT_SETTINGS): Promise<SyncResult> {
  const auth = await loadState<{ token?: string }>(STORAGE_KEYS.AUTH, {});
  if (!auth.token) {
    throw new Error('GitHub authentication required');
  }

  const repo = settings.repository;
  if (!repo) {
    throw new Error('Repository is not configured yet.');
  }

  const branch = settings.branch || 'main';
  const problemNumber = normalizeProblemNumber(payload.problemNumber || payload.problemId || payload.slug);
  const title = normalizeProblemTitle(payload.title);
  const extension = resolveLanguageExtension(payload.language, payload.code);
  const platformFolder = resolvePlatformFolder(payload.platform);
  const topicFolder = payload.primaryTopic ? `${payload.primaryTopic}/` : '';
  const fileName = payload.platform === 'leetcode' ? `${problemNumber}. ${title}.${extension}` : `${title}.${extension}`;
  const filePath = `${platformFolder}/${topicFolder}${fileName}`;
  const existingFile = await getGitHubFile(repo, branch, auth.token, filePath);

  let targetFilePath = filePath;
  let targetSha = existingFile?.sha;

  if (existingFile) {
    if (existingFile.content === payload.code) {
      return {
        ok: true,
        status: 'duplicate',
        message: `Already synced ${fileName}`,
        url: `https://github.com/${repo}/blob/${branch}/${toGitHubBlobPath(filePath)}`,
        filePath
      };
    }

    if (settings.overwriteBehavior === 'skip') {
      return {
        ok: true,
        status: 'duplicate',
        message: `Skipped ${fileName} (Already exists)`,
        url: `https://github.com/${repo}/blob/${branch}/${toGitHubBlobPath(filePath)}`,
        filePath
      };
    }

    if (settings.overwriteBehavior === 'versioned') {
      let version = 1;
      let newFilePath = '';
      let newFileExists = true;
      while (newFileExists) {
        newFilePath = `${platformFolder}/${topicFolder}${fileName.replace(`.${extension}`, `_${version}.${extension}`)}`;
        const checkFile = await getGitHubFile(repo, branch, auth.token, newFilePath);
        if (!checkFile) {
          newFileExists = false;
        } else if (checkFile.content === payload.code) {
          return {
            ok: true,
            status: 'duplicate',
            message: `Already synced ${fileName.replace(`.${extension}`, `_${version}.${extension}`)}`,
            url: `https://github.com/${repo}/blob/${branch}/${toGitHubBlobPath(newFilePath)}`,
            filePath: newFilePath
          };
        } else {
          version++;
        }
      }
      targetFilePath = newFilePath;
      targetSha = undefined;
    }
  }

  const commitMessage = buildCommitMessage(payload.platform, title, Boolean(existingFile && targetSha));
  await putGitHubFile(repo, branch, auth.token, targetFilePath, payload.code, targetSha, commitMessage);

  return {
    ok: true,
    status: 'success',
    message: `Synced ${targetFilePath.split('/').pop()}`,
    url: `https://github.com/${repo}/blob/${branch}/${toGitHubBlobPath(targetFilePath)}`,
    filePath: targetFilePath
  };
}

async function getGitHubFile(repo: string, branch: string, token: string, path: string): Promise<{ sha?: string; content: string } | null> {
  const response = await fetch(`${githubContentsUrl(repo, path)}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(error.message || 'Unable to check existing repository file.');
  }

  const data = await response.json() as { sha?: string; content?: string; encoding?: string };
  return {
    sha: data.sha,
    content: data.encoding === 'base64' ? decodeBase64Content(data.content || '') : (data.content || '')
  };
}

async function putGitHubFile(repo: string, branch: string, token: string, path: string, content: string, sha: string | undefined, commitMessage: string): Promise<void> {
  const response = await fetch(githubContentsUrl(repo, path), {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: commitMessage,
      content: encodeBase64Content(content),
      branch,
      ...(sha ? { sha } : {})
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(error.message || 'Unable to sync solution to GitHub.');
  }
}

function githubContentsUrl(repo: string, path: string): string {
  return `https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'code-sync-extension'
  };
}

function encodeBase64Content(content: string): string {
  return btoa(unescape(encodeURIComponent(content)));
}

function decodeBase64Content(content: string): string {
  return decodeURIComponent(escape(atob(content.replace(/\n/g, ''))));
}

function normalizeProblemNumber(value: string): string {
  const digits = value.match(/\d+/)?.[0] ?? value;
  return digits.padStart(4, '0');
}

function resolvePlatformFolder(platform: SubmissionPayload['platform']): string {
  switch (platform) {
    case 'gfg': return 'GeeksForGeeks';
    case 'hackerrank': return 'HackerRank';
    case 'codingninjas': return 'CodingNinjas';
    case 'leetcode':
    default:
      return 'LeetCode';
  }
}

function buildCommitMessage(platform: SubmissionPayload['platform'], title: string, isUpdate: boolean): string {
  switch (platform) {
    case 'gfg': return `${isUpdate ? 'Update' : 'Add'} GFG solution: ${title}`;
    case 'hackerrank': return `${isUpdate ? 'Update' : 'Add'} HackerRank solution: ${title}`;
    case 'codingninjas': return `${isUpdate ? 'Update' : 'Add'} Coding Ninjas solution: ${title}`;
    case 'leetcode':
    default:
      return `Solved ${title}`;
  }
}

function normalizeProblemTitle(value: string): string {
  return value
    .replace(/^\d+[.)\-:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '');
}

function toGitHubBlobPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
}
