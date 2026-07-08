/** Stable extension ID when manifest.json includes a fixed `key` field. */
export const STABLE_EXTENSION_ID = 'plnopbamiedbgmoopcngjnjflkeagebd';

export const GITHUB_CLIENT_ID = 'Ov23liFtzyAJzfzRmUfN';

const apiBaseUrl = typeof globalThis !== 'undefined' && (globalThis as { __CODESYNC_API_BASE_URL__?: string }).__CODESYNC_API_BASE_URL__
  ? (globalThis as { __CODESYNC_API_BASE_URL__?: string }).__CODESYNC_API_BASE_URL__
  : 'https://code-sync-extension-backend.onrender.com';

export const CONFIG = {
  API_BASE_URL: apiBaseUrl,
  GITHUB_API: 'https://api.github.com',
  GITHUB_CLIENT_ID,
  /** Web OAuth via chrome.identity is attempted first; device flow is the fallback. */
  USE_WEB_OAUTH_FLOW: true
};

export function getApiUrl(path: string): string {
  return `${CONFIG.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Redirect URI GitHub receives during authorize + token exchange.
 * Must exactly match the OAuth app's Authorization callback URL.
 */
export function getOAuthRedirectUri(): string {
  if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
    return chrome.identity.getRedirectURL();
  }

  return `https://${STABLE_EXTENSION_ID}.chromiumapp.org/`;
}
