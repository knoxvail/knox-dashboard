# Knox Dashboard

Greyscale Iron Man HUD-style personal dashboard. Live clock, WSJ headlines, Notion tasks, Gmail inbox, Spotify player, schedule, and daily Bible verse.

---

## Features

| Panel | Source | Features |
|---|---|---|
| **Clock** | Local | Live clock & date |
| **WSJ Headlines** | WSJ RSS feed | Top 7 headlines (~15 min cache) |
| **Tasks** | Notion API | Short-term & long-term tasks, add & complete |
| **Inbox** | Gmail API | 8 latest emails, archive action |
| **Spotify** | Spotify API | Now playing, play/pause/next/prev, volume control, playlist switching |
| **Up Next** | Notion Schedule DB | Calendar events with filtering |
| **Bible Verse** | Curated list | Daily rotating verse |

---

## Local Setup

### Prerequisites
- Node.js 18+
- Notion workspace with two databases (Tasks & Schedule)
- Gmail account with OAuth2 access
- Spotify account with Developer app
- Optional: WSJ RSS access (public feed)

### 1. Clone & Install

```bash
git clone https://github.com/knoxvail/knox-dashboard.git
cd knox-dashboard
npm install
cp .env.example .env.local
```

### 2. Configure Environment Variables

Edit `.env.local` with your credentials:

**Notion**
- Get token: https://www.notion.so/my-integrations
- Create integration, copy `secret_xxx` token
- Create two databases and get their IDs:
  - Task database (with Status: Short Term/Long Term)
  - Schedule database (with Date and Type fields)

**Spotify**
- Go to https://developer.spotify.com/dashboard
- Create an app, get Client ID & Secret
- Add `http://localhost:3001/api/spotify/callback` to Redirect URIs

**Gmail**
- Go to https://console.cloud.google.com/apis/credentials
- Create OAuth 2.0 Web Application credentials
- Add `http://localhost:3001/api/gmail/callback` to authorized redirect URIs
- Requires `gmail.modify` scope for archive functionality

### 3. Run Locally

```bash
npm run dev
# Open http://localhost:3001
```

### 4. Click "Connect" for Gmail & Spotify

On first load, click the connect buttons to authorize Gmail and Spotify. Tokens are stored in httpOnly cookies.

---

## Deploy to Vercel

1. Push code to GitHub
2. Connect GitHub repo to Vercel
3. Set environment variables in Vercel dashboard (same as `.env.example`)
4. Deploy

Note: Update `NEXT_PUBLIC_SITE_URL` in Vercel to your actual deployment URL if different from the default.

---

## Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Production | `https://knox-dashboard.vercel.app` |
| `NOTION_TOKEN` | Yes | `secret_xxx...` |
| `NOTION_DB_ID` | Yes | Task database ID |
| `NOTION_SCHEDULE_DB_ID` | Yes | Schedule database ID |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Yes | Spotify app ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app secret |
| `SPOTIFY_REDIRECT_URI` | Yes | OAuth callback URL |
| `GOOGLE_CLIENT_ID` | Yes | Google app ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google app secret |
| `GMAIL_USER_INDEX` | No (default: 0) | Account index (0 for primary) |
| `TZ` | No (default: America/Los_Angeles) | Timezone for schedule |

---

## Architecture

- **Frontend**: Next.js 14 with React 18, Tailwind CSS, TypeScript
- **Backend**: Next.js API routes
- **Auth**: OAuth 2.0 (Spotify, Gmail) via HTTP-only cookies
- **Styling**: Greyscale with retro terminal aesthetic
- **Deployment**: Vercel (serverless)
