import { Router } from 'express';

const router = Router();

router.get('/user', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing GitHub token.' });
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'code-sync-extension',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Unable to fetch GitHub profile.' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub request failed.';
    return res.status(500).json({ error: message });
  }
});

router.get('/repos', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing GitHub token.' });
  }

  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'code-sync-extension',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Unable to fetch repositories.' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub request failed.';
    return res.status(500).json({ error: message });
  }
});

router.get('/branches/:repo(*)', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing GitHub token.' });
  }

  try {
    const repository = decodeURIComponent(req.params.repo || '');
    const response = await fetch(`https://api.github.com/repos/${repository}/branches?per_page=100`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'code-sync-extension',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Unable to fetch branches.' });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub request failed.';
    return res.status(500).json({ error: message });
  }
});

export default router;
