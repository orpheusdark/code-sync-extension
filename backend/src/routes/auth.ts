import { Router } from 'express';
import { CONFIG } from '../config.js';

const router = Router();

router.get(['/auth/github/callback', '/login/oauth/callback'], (_req, res) => {
  res.type('html').send(`<!doctype html><html><body><script>window.close();</script><p>Authentication complete. You can close this window.</p></body></html>`);
});

router.post('/auth/github/device', async (_req, res) => {
  try {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: CONFIG.GITHUB_CLIENT_ID,
        scope: 'repo,user:email'
      })
    });

    const data = await response.json() as { error?: string; error_description?: string; device_code?: string; user_code?: string; verification_uri?: string; verification_uri_complete?: string; interval?: number };

    if (!response.ok || !data.device_code || !data.verification_uri) {
      return res.status(response.status).json({ error: data.error_description || data.error || 'Unable to start GitHub device flow.' });
    }

    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start GitHub device flow.';
    return res.status(500).json({ error: message });
  }
});

router.post('/auth/github/device/verify', async (req, res) => {
  try {
    const { deviceCode } = req.body as { deviceCode?: string };

    if (!deviceCode) {
      return res.status(400).json({ error: 'Device code is required.' });
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: CONFIG.GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });

    const data = await response.json() as { access_token?: string; error?: string; error_description?: string; interval?: number };

    if (!response.ok || !data.access_token) {
      return res.status(response.status).json({
        error: data.error_description || data.error || 'Unable to complete GitHub device flow.',
        pending: data.error === 'authorization_pending'
      });
    }

    return res.json({ access_token: data.access_token });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete GitHub device flow.';
    return res.status(500).json({ error: message });
  }
});

router.post('/auth/github', async (req, res) => {
  try {
    const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required.' });
    }

    if (!CONFIG.GITHUB_CLIENT_ID || !CONFIG.GITHUB_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'GitHub OAuth is not configured in this environment. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env.'
      });
    }

    const tokenBody: Record<string, string> = {
      client_id: CONFIG.GITHUB_CLIENT_ID,
      client_secret: CONFIG.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri
    };

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenBody)
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string; error_uri?: string };

    if (!tokenData.access_token) {
      return res.status(401).json({
        error: tokenData.error_description || tokenData.error || 'Invalid OAuth code.',
        details: tokenData.error_uri
      });
    }

    return res.json({ access_token: tokenData.access_token });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed.';
    return res.status(500).json({ error: message });
  }
});

export default router;
