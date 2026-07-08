# CodeSync Extension

CodeSync is a Chrome extension that syncs accepted coding-platform submissions into GitHub.

## Architecture

- Extension: browser-side UI, OAuth initiation, and sync logic
- Backend: local Express server that exchanges GitHub OAuth codes for access tokens

## Local development

1. Install extension dependencies:
   ```bash
   npm install
   ```
2. Install backend dependencies:
   ```bash
   cd backend && npm install
   ```
3. Configure GitHub OAuth in the backend environment:
   ```bash
   cd backend
   cp .env .env.local
   ```
   Fill in:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `PORT=3000`
4. Start the backend:
   ```bash
   cd backend && npm run dev
   ```
5. Build the extension:
   ```bash
   npm run build
   ```
6. Load the unpacked extension from the `dist` folder in Chrome.

## OAuth setup

CodeSync uses GitHub's **Device Authorization Flow** by default. This avoids redirect URI
registration entirely and works on every machine.

Steps:

1. Create a [GitHub OAuth App](https://github.com/settings/developers).
2. Enable **Device Flow** on the OAuth app (Developer settings → OAuth Apps → your app).
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the backend (Render env vars or `backend/.env`).
4. Copy the client ID into `src/shared/config.ts` (`GITHUB_CLIENT_ID`) if it differs.

Sign-in flow:

1. Click **Continue with GitHub** in the popup.
2. A device code appears and `github.com/login/device` opens in a new tab.
3. Enter the code on GitHub and approve access.
4. The extension connects automatically once approval completes.

### Optional: browser redirect flow

If you prefer the one-click GitHub popup instead of device codes:

1. Set **Authorization callback URL** on the OAuth app to:

   ```text
   https://plnopbamiedbgmoopcngjnjflkeagebd.chromiumapp.org/
   ```

2. Set `USE_WEB_OAUTH_FLOW: true` in `src/shared/config.ts` and rebuild.

The backend only exchanges tokens; it is never used as the OAuth redirect target.

## Production migration

To move from local development to production, change only the backend configuration value:

```ts
API_BASE_URL: "http://localhost:3000";
```

Update it to your hosted backend URL such as:

```ts
API_BASE_URL: "https://api.codesync.dev";
```

The extension logic remains the same.
