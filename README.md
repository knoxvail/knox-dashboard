# Knox Dashboard

Iron Man HUD-style personal dashboard. Live clock, WSJ headlines, Notion tasks, daily Bible verse.

---

## Deploy to Vercel (15 min)

### 1. Get your Notion Integration Token

1. Go to https://www.notion.so/my-integrations
2. Click **"New integration"**
3. Name it "Dashboard", select your workspace, click Submit
4. Copy the **Internal Integration Token** (starts with `secret_`)
5. Go to your Task database in Notion → click **"..."** menu → **"Add connections"** → select your integration

### 2. Push to GitHub

```bash
cd dashboard
git init
git add .
git commit -m "init dashboard"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOURNAME/knox-dashboard.git
git push -u origin main
```

### 3. Deploy on Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Before clicking Deploy, go to **Environment Variables** and add:
   - `NOTION_TOKEN` → your `secret_xxx` token
   - `NOTION_DB_ID` → `203c40ab-ce39-81aa-bc49-000b70ec35e6`
4. Click **Deploy**
5. Vercel gives you a URL like `https://knox-dashboard.vercel.app`

### 4. Set as Chrome startup page

1. Chrome → Settings → **On startup**
2. Select **"Open a specific page or set of pages"**
3. Click **"Add a new page"** → paste your Vercel URL
4. Done. Every Chrome launch opens the dashboard.

---

## Local dev

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your tokens
npm run dev
# open http://localhost:3000
```

---

## What's in it

| Panel | Source | Refresh |
|---|---|---|
| Clock | Local | Every second |
| WSJ Headlines | WSJ RSS feed | Every 15 min |
| Tasks | Notion API | Every 5 min |
| Bible verse | Curated list | Daily |
