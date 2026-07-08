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

Create a GitHub OAuth app and set the callback URL to:

```text
http://localhost:3000/auth/github/callback
```

For local testing, use the backend as the token exchange layer. The extension never handles the client secret.

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
