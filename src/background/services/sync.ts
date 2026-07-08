import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../shared/constants';
import { loadState } from '../../shared/storage';
import type { SubmissionPayload, SyncSettings } from '../../shared/types';

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
  const problemNumber = normalizeProblemNumber(payload.problemNumber || payload.problemId);
  const title = normalizeProblemTitle(payload.title);
  const extension = resolveLanguageExtension(payload.language, payload.code);
  const fileName = `${problemNumber}. ${title}.${extension}`;
  const filePath = `LeetCode/${fileName}`;
  const existingFile = await getGitHubFile(repo, branch, auth.token, filePath);

  if (existingFile && existingFile.content === payload.code) {
    return {
      ok: true,
      status: 'duplicate',
      message: `Already synced ${fileName}`,
      url: `https://github.com/${repo}/blob/${branch}/${toGitHubBlobPath(filePath)}`,
      filePath
    };
  }

  await putGitHubFile(repo, branch, auth.token, filePath, payload.code, existingFile?.sha, fileName);

  return {
    ok: true,
    status: 'success',
    message: `Synced ${fileName}`,
    url: `https://github.com/${repo}/blob/${branch}/${toGitHubBlobPath(filePath)}`,
    filePath
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

async function putGitHubFile(repo: string, branch: string, token: string, path: string, content: string, sha: string | undefined, fileName: string): Promise<void> {
  const response = await fetch(githubContentsUrl(repo, path), {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: `Solved ${fileName}`,
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

function resolveLanguageExtension(language: string, code = ''): string {
  const normalized = language.toLowerCase().replace(/\s+/g, ' ').trim();
  const codeNormalized = code.trim();

  const languageToExtension: Record<string, string> = {
    'python': 'py',
    'python 3': 'py',
    'python3': 'py',
    'py': 'py',
    'javascript': 'js',
    'javascript (node.js)': 'js',
    'javascript (node)': 'js',
    'node.js': 'js',
    'js': 'js',
    'typescript': 'ts',
    'ts': 'ts',
    'java': 'java',
    'java 8': 'java',
    'java 11': 'java',
    'java 17': 'java',
    'c#': 'cs',
    'c sharp': 'cs',
    'csharp': 'cs',
    'cs': 'cs',
    'c++': 'cpp',
    'cpp': 'cpp',
    'c plus plus': 'cpp',
    'c': 'c',
    'c language': 'c',
    'go': 'go',
    'golang': 'go',
    'rust': 'rs',
    'kotlin': 'kt',
    'swift': 'swift',
    'php': 'php',
    'ruby': 'rb',
    'scala': 'scala',
    'dart': 'dart'
  };

  if (languageToExtension[normalized]) {
    return languageToExtension[normalized];
  }

  if (normalized.includes('python')) return 'py';
  if (normalized.includes('javascript') || normalized.includes('node.js')) return 'js';
  if (normalized.includes('typescript')) return 'ts';
  if (normalized.includes('java')) return 'java';
  if (normalized.includes('c#') || normalized.includes('csharp') || normalized.includes('c sharp')) return 'cs';
  if (normalized.includes('c++') || normalized.includes('cpp') || normalized.includes('c plus plus')) return 'cpp';
  if (normalized === 'c' || normalized.includes('c language')) return 'c';
  if (normalized.includes('go') || normalized.includes('golang')) return 'go';
  if (normalized.includes('rust')) return 'rs';
  if (normalized.includes('kotlin')) return 'kt';
  if (normalized.includes('swift')) return 'swift';
  if (normalized.includes('php')) return 'php';
  if (normalized.includes('ruby')) return 'rb';
  if (normalized.includes('scala')) return 'scala';
  if (normalized.includes('dart')) return 'dart';

  if (looksLikePython(codeNormalized)) return 'py';
  if (looksLikeJava(codeNormalized)) return 'java';
  if (looksLikeJavaScript(codeNormalized)) return 'js';
  if (looksLikeTypeScript(codeNormalized)) return 'ts';
  if (looksLikeCpp(codeNormalized)) return 'cpp';
  if (looksLikeCSharp(codeNormalized)) return 'cs';
  if (looksLikeGo(codeNormalized)) return 'go';

  return 'txt';
}

function looksLikePython(code: string): boolean {
  if (!code) return false;
  return /(^|\n)\s*def\s+\w+\s*\(/.test(code) || /(^|\n)\s*class\s+\w+\s*:/.test(code) || /(^|\n)\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(code);
}

function looksLikeJava(code: string): boolean {
  if (!code) return false;
  return /\bpublic\s+class\s+\w+/.test(code) || /\bimport\s+java\./.test(code) || /\bSystem\.out\.print/.test(code);
}

function looksLikeJavaScript(code: string): boolean {
  if (!code) return false;
  return /\bfunction\s+\w+\s*\(/.test(code) || /\bconst\s+\w+\s*=/.test(code) || /\blet\s+\w+\s*=/.test(code) || /=>/.test(code);
}

function looksLikeTypeScript(code: string): boolean {
  if (!code) return false;
  return /:\s*(string|number|boolean|any|unknown)\b/.test(code) || /\binterface\s+\w+/.test(code) || /\btype\s+\w+\s*=/.test(code);
}

function looksLikeCpp(code: string): boolean {
  if (!code) return false;
  return /#include\s*<.*>/.test(code) || /\bstd::/.test(code) || /\busing\s+namespace\s+std\b/.test(code);
}

function looksLikeCSharp(code: string): boolean {
  if (!code) return false;
  return /\busing\s+System\b/.test(code) || /\bnamespace\s+\w+/.test(code) || /\bConsole\.Write(Line)?\b/.test(code);
}

function looksLikeGo(code: string): boolean {
  if (!code) return false;
  return /\bpackage\s+main\b/.test(code) || /\bfunc\s+\w+\s*\(/.test(code) || /\bfmt\./.test(code);
}
