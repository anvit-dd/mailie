# Gmail OAuth2 Setup

To enable real Gmail access, set up OAuth2 credentials in Google Cloud Console.

## Step 1: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the **Gmail API**:
   - Go to **APIs & Services > Library**
   - Search for "Gmail API"
   - Click Enable

## Step 2: Configure OAuth2 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Add **Authorized redirect URI**:
   ```
   https://your-domain.com/api/auth/callback
   ```
   (e.g. `http://localhost:3333/api/auth/callback` for local dev)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

## Step 3: Fill in Environment Variables

```bash
cp .env.example .env.local
```

Fill in your values in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_GMAIL_CLIENT_ID` | Google Cloud Console → OAuth client |
| `GMAIL_CLIENT_SECRET` | Google Cloud Console → OAuth client |
| `SESSION_SECRET` | Run `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3333` for dev, or your production domain |

## Step 4: Run

```bash
npm install
npm run dev
```

Open http://localhost:3333 and click **Connect Gmail**.

## Troubleshooting

### "redirect_uri_mismatch"
The redirect URI in Google Cloud Console doesn't match your `NEXT_PUBLIC_APP_URL`.
- For dev: make sure the redirect URI is `http://localhost:3333/api/auth/callback`
- For prod: must be exactly `https://your-domain.com/api/auth/callback`

### "Token refresh failed"
- Make sure `GMAIL_CLIENT_SECRET` is set in `.env.local`
- The refresh token is only provided on first login
- To get a new refresh token: revoke access at myaccount.google.com/permissions and log in again
