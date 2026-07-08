const extensionId = typeof chrome !== 'undefined' && chrome.runtime?.id
  ? chrome.runtime.id
  : 'pecpcibjejmenjkndjblphpkmideiadn';

const apiBaseUrl = typeof globalThis !== 'undefined' && (globalThis as { __CODESYNC_API_BASE_URL__?: string }).__CODESYNC_API_BASE_URL__
  ? (globalThis as { __CODESYNC_API_BASE_URL__?: string }).__CODESYNC_API_BASE_URL__
  : 'http://localhost:3000';

export const CONFIG = {
  API_BASE_URL: apiBaseUrl,
  GITHUB_API: 'https://api.github.com',
  OAUTH_REDIRECT_URI: `https://${extensionId}.chromiumapp.org/`
};

export function getApiUrl(path: string): string {
  return `${CONFIG.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getOAuthRedirectUri(): string {
  return CONFIG.OAUTH_REDIRECT_URI;
}
