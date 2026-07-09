/**
 * CodeSync
 * Original Author: orpheusdark
 * Project: CodeSync Browser Extension
 */
import { CONFIG, getApiUrl, getOAuthRedirectUri } from '../../shared/config';
import { MESSAGE_TYPES } from '../../shared/messages';
import { saveState } from '../../shared/storage';
import { STORAGE_KEYS } from '../../shared/constants';
import { verifyGitHubToken } from './api';

export interface GitHubAuthResult {
  ok: boolean;
  message: string;
  code?: string;
  pending?: boolean;
  verificationUri?: string;
  verificationUriComplete?: string;
}

let devicePollActive = false;
let activeDeviceCode: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isUserCancelled(message: string): boolean {
  return /cancel/i.test(message);
}

function shouldFallbackToDeviceFlow(message: string): boolean {
  if (isUserCancelled(message)) {
    return false;
  }

  return true;
}

export function cancelDeviceAuthorization(): void {
  devicePollActive = false;
  activeDeviceCode = null;
  void saveState(STORAGE_KEYS.PENDING_DEVICE_AUTH, null);
}

function buildVerificationUriComplete(userCode: string, verificationUri?: string, verificationUriComplete?: string): string {
  if (verificationUriComplete) {
    return verificationUriComplete;
  }

  const base = verificationUri || 'https://github.com/login/device';
  const normalizedCode = userCode.replace(/\s+/g, '').toUpperCase();
  const url = new URL(base);
  url.searchParams.set('user_code', normalizedCode);
  return url.toString();
}

async function exchangeAuthorizationCode(code: string, redirectUri: string): Promise<string> {
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

  return tokenData.access_token;
}

async function completeAuthentication(accessToken: string, message: string): Promise<GitHubAuthResult> {
  cancelDeviceAuthorization();
  await verifyGitHubToken(accessToken);

  try {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.AUTH_SUCCESS,
      payload: { message }
    });
  } catch {
    // Popup may be closed; auth state is still persisted.
  }

  return { ok: true, message };
}

async function authenticateWithWebFlow(): Promise<GitHubAuthResult> {
  const clientId = CONFIG.GITHUB_CLIENT_ID;
  const redirectUri = getOAuthRedirectUri();
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user:email&state=${Date.now()}`;

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

  const parsed = new URL(responseUrl);
  const error = parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
  if (error) {
    throw new Error(error);
  }

  const code = parsed.searchParams.get('code');
  if (!code) {
    throw new Error('GitHub did not return an authorization code.');
  }

  const accessToken = await exchangeAuthorizationCode(code, redirectUri);
  return completeAuthentication(accessToken, 'GitHub connected successfully.');
}

async function pollDeviceAuthorization(deviceCode: string, intervalSeconds: number): Promise<void> {
  if (devicePollActive && activeDeviceCode === deviceCode) {
    return;
  }

  devicePollActive = true;
  activeDeviceCode = deviceCode;

  try {
    while (devicePollActive && activeDeviceCode === deviceCode) {
      await sleep(Math.max(intervalSeconds, 5) * 1000);

      const response = await fetch(getApiUrl('/auth/github/device/verify'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deviceCode })
      });

      const data = await response.json() as {
        access_token?: string;
        pending?: boolean;
        error?: string;
      };

      if (data.access_token) {
        await completeAuthentication(data.access_token, 'GitHub connected successfully.');
        return;
      }

      if (data.pending) {
        continue;
      }

      throw new Error(data.error || 'Unable to complete GitHub device authorization.');
    }
  } catch (error) {
    if (!devicePollActive || activeDeviceCode !== deviceCode) {
      return;
    }

    const message = error instanceof Error ? error.message : 'Device authorization failed.';
    try {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.AUTH_FAILED,
        payload: { message }
      });
    } catch {
      // Popup may be closed.
    }
  } finally {
    if (activeDeviceCode === deviceCode) {
      devicePollActive = false;
      activeDeviceCode = null;
    }
  }
}

async function startDeviceFlow(): Promise<GitHubAuthResult> {
  const response = await fetch(getApiUrl('/auth/github/device'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || 'Unable to start GitHub device authorization.');
  }

  const data = await response.json() as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    interval?: number;
  };

  if (!data.device_code || !data.user_code) {
    throw new Error('GitHub did not return a device authorization code.');
  }

  const verificationUriComplete = buildVerificationUriComplete(
    data.user_code,
    data.verification_uri,
    data.verification_uri_complete
  );

  await saveState(STORAGE_KEYS.PENDING_DEVICE_AUTH, {
    userCode: data.user_code,
    verificationUri: data.verification_uri || 'https://github.com/login/device',
    verificationUriComplete,
    startedAt: new Date().toISOString()
  });

  void pollDeviceAuthorization(data.device_code, data.interval ?? 5);

  return {
    ok: true,
    pending: true,
    code: data.user_code,
    verificationUri: data.verification_uri || 'https://github.com/login/device',
    verificationUriComplete,
    message: 'One-click sign-in failed. Copy the device code below, then authorize on GitHub.'
  };
}

export async function authenticateWithGitHub(): Promise<GitHubAuthResult> {
  if (CONFIG.USE_WEB_OAUTH_FLOW) {
    try {
      return await authenticateWithWebFlow();
    } catch (webError) {
      const webMessage = webError instanceof Error ? webError.message : 'Authentication failed.';

      if (!shouldFallbackToDeviceFlow(webMessage)) {
        return { ok: false, message: webMessage };
      }

      try {
        const deviceResult = await startDeviceFlow();
        return {
          ...deviceResult,
          message: `Quick sign-in unavailable (${webMessage}). Use the device code below instead.`
        };
      } catch (deviceError) {
        const deviceMessage = deviceError instanceof Error ? deviceError.message : 'Device authorization failed.';
        return {
          ok: false,
          message: `${webMessage} Device flow also failed: ${deviceMessage}`
        };
      }
    }
  }

  try {
    return await startDeviceFlow();
  } catch (deviceError) {
    const deviceMessage = deviceError instanceof Error ? deviceError.message : 'Device authorization failed.';
    return {
      ok: false,
      message: `${deviceMessage} Enable Device Flow in your GitHub OAuth app settings if needed.`
    };
  }
}
