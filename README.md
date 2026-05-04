# mailie

> Minimal brutalist email client — Gmail OAuth2, dark mode, mobile-first.

**mailie** is a lightweight webmail client that connects to your Gmail account via OAuth2. Built with Next.js 15, shadcn/ui, and SQLite for session storage. No database setup required — just configure and run.

## Features

- 🔐 **Gmail OAuth2** — secure authentication, tokens stored server-side in SQLite
- 🌙 **Dark mode** — brutalist minimal aesthetic, always-on dark
- 📱 **Responsive** — mobile-first design, slides into full-screen reader on phone
- ⚡ **Fast** — SQLite sessions, lazy-loaded email bodies via `srcDoc` iframes
- 🛡️ **Secure** — HTTP-only session cookies, CSP headers, no email passwords stored

## Setup

### 1. Clone & install

```bash
git clone https://github.com/anvit-dd/mailie.git
cd mailie
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_GMAIL_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID |
| `GMAIL_CLIENT_SECRET` | Same OAuth client, copy the secret |
| `SESSION_SECRET` | Run `openssl rand -hex 32` to generate |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3333` for dev, or your production domain |

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add an **authorized redirect URI**:
   - Dev: `http://localhost:3333/api/auth/callback`
   - Production: `https://your-domain.com/api/auth/callback`
4. Copy the **Client ID** and **Client Secret** into `.env.local`

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3333](http://localhost:3333) and click **Connect Gmail**.

## Tech stack

- **Next.js 15** (App Router, TypeScript)
- **shadcn/ui** + **Tailwind CSS v4**
- **SQLite** via `better-sqlite3` (sessions + token storage)
- **Gmail API** via Google OAuth2

## Architecture

```
src/
├── app/api/
│   ├── auth/          # OAuth2 flow, session management
│   └── gmail/         # Gmail API proxy (list, read, send, modify)
├── components/        # UI components
├── contexts/          # Auth + email React contexts
└── lib/
    ├── db.ts          # SQLite schema (accounts, sessions, tokens)
    └── session.ts     # Session CRUD helpers
```

## Deployment

```bash
npm run build
npm start
```

Any platform that supports Node.js (Vercel, Railway, Render, Fly.io, etc.).

> **Note:** For production on Vercel, either switch `better-sqlite3` to `@libsql/client` (Turso) or use a serverless-compatible SQLite binding. The current `better-sqlite3` approach works on VPS/dedicated Node.js hosting.

## License

MIT
