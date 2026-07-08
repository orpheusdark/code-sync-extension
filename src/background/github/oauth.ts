import { getApiUrl, getOAuthRedirectUri } from '../../shared/config';
import { saveState } from '../../shared/storage';
import { STORAGE_KEYS } from '../../shared/constants';
import { verifyGitHubToken } from './api';

export async function authenticateWithGitHub(): Promise<{ ok: boolean; message: string }> {
  const clientId = 'Ov23liFtzyAJzfzRmUfN';
  const redirectUri = getOAuthRedirectUri();
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user:email&state=${Date.now()}`;

  try {
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!redirectUrl) {
          reject(new Error('GitHub sign-in was cancelled.'));
          return;
        }
        resolve(redirectUrl);
      });
    });

    const code = new URL(responseUrl).searchParams.get('code');
    if (!code) {
      throw new Error('GitHub did not return an authorization code.');
    }

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(getApiUrl('/auth/github'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, redirectUri })
      });
    } catch {
      throw new Error('Unable to reach the auth backend. Make sure the backend is available.');
    }

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({}));
      throw new Error((error as { error?: string }).error || 'Unable to complete the backend token exchange.');
    }

    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new Error('The backend did not return an access token.');
    }

    await saveState(STORAGE_KEYS.AUTH, { authenticated: true, token: tokenData.access_token });
    await verifyGitHubToken(tokenData.access_token);
    return { ok: true, message: 'GitHub connected successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.';
    return { ok: false, message };
  }
}
