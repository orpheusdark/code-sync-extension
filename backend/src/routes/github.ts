import { Router, Request, Response } from 'express';

const router = Router();

router.get('/user', async (req: Request, res: Response) => {
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
      return res
        .status(response.status)
        .json({ error: 'Unable to fetch GitHub profile.' });
    }

    return res.json(await response.json());
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'GitHub request failed.'
    });
  }
});

router.get('/repos', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing GitHub token.' });
  }

  try {
    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'code-sync-extension',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: 'Unable to fetch repositories.' });
    }

    return res.json(await response.json());
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'GitHub request failed.'
    });
  }
});

router.get(
  '/branches/:repo(*)',
  async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing GitHub token.' });
    }

    try {
      const repoParam = req.params.repo;

      if (!repoParam) {
        return res.status(400).json({
          error: 'Repository parameter is required.'
        });
      }

      const repository = decodeURIComponent(
        Array.isArray(repoParam)
          ? repoParam.join('/')
          : repoParam
      );

      const response = await fetch(
        `https://api.github.com/repos/${repository}/branches?per_page=100`,
        {
          headers: {
            Authorization: authHeader,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'code-sync-extension',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: 'Unable to fetch branches.' });
      }

      return res.json(await response.json());
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'GitHub request failed.'
      });
    }
  }
);

export default router;