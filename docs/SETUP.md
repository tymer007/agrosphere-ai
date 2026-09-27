# Agrosphere AI - Setup Guide

## 1. Run it locally

```bash
cd ai-web
cp .env.example .env.local     # fill in values later; the app works without them
npm install
npm start                      # http://localhost:3000  (redirects to /home)
```

`npm start` runs `dev-server.mjs`. It serves clean URLs (`/home`, `/login`, `/dashboard`...) and runs the `/api` functions with your `.env.local`.
Opening the `.html` files directly (`file://`) will not work - modules and clean URLs need a server.

**Deploy:** push the folder to GitHub → import it on vercel.com (Framework preset: *Other*, no build command). `vercel.json` turns on `cleanUrls` (no `.html` in any URL) and redirects `/` → `/home`.

## 2. How data is stored right now

Everything is in the browser's `localStorage`, including accounts:

| Key | What |
|---|---|
| `agro_entries` | **Every** record as a row: `{ id, userId, entryType, data, createdAt, updatedAt, deleted }` |
| `agro_session` | Logged-in user id + expiry (30 days) |
| `agro_sync_queue` | Row ids changed since the last Excel sync |
| `agro_ai_usage_device` | Today's AI usage on this device |
| `agro_theme_pref`, `agro_lang`, `agro_last_section` | Preferences |

`entryType` values: `user`, `profile`, `farm`, `crop`, `livestock`, `record`, `analysis`, `chat_memory`, `ai_usage`.
The rows have exactly the same shape as the Excel table below, so switching sync on needs no data migration.

Passwords are stored as salted SHA-256 hashes, never as plain text.

---

## 3. Excel spreadsheet (one file, every row tied to a user)

### Where the file lives

There is **one** Excel file, `agrosphere-ai-data.xlsx`, with **one** sheet, `Entries`:

| id | userId | entryType | data | createdAt | updatedAt | deleted |
|---|---|---|---|---|---|---|
| cro_m1x... | usr_m1a... | crop | `{"name":"Maize","health":"good",...}` | 2026-09-27T10:00:00Z | 2026-09-27T10:05:00Z | FALSE |

- **Live site:** the file is stored in **Vercel Blob** as a *private* file. It is not in GitHub, and nobody can open it by URL.
- **Local development** (`node dev-server.mjs` without a Blob token): the same code writes a real file to **`.data/agrosphere-ai-data.xlsx`** on your computer. You can open it in Excel. `.data` is git-ignored.

GitHub only holds the **code**. The data never goes into the repository.

### How updates reach the file

1. The app saves every change in the browser (`localStorage`) straight away, and the page never waits for Excel.
2. About 4 seconds after the last change, or when the tab is hidden, `js/sync.js` sends the changed rows to **`/api/sheet`**.
3. `/api/sheet` downloads `agrosphere-ai-data.xlsx` from Blob, updates the matching rows by `id` (the newest `updatedAt` wins) or adds new ones, and uploads the file again.
   - Each upload is *conditional*: if another save happened in between, it re-reads the file and retries, so no update is lost.
4. **Logging in on another device:** `/api/sheet` checks the password against the `user` row and sends back every row with that `userId`. The rows are merged into that device's `localStorage`.
5. **Staying in sync:** an open dashboard pulls new rows when it loads and whenever you come back to the tab.

Deletes are soft (`deleted = TRUE`). The demo account is never synced; it stays on each device.

### Setup (about 3 minutes)

1. **Vercel → your project → Storage → Create Database → Blob**, then fill in the form:

   | Field | Value |
   |---|---|
   | Name | `agrosphere-data` |
   | Region | any; pick the one closest to your users, e.g. London (lhr1). It can't be changed later. |
   | Access | **Private** (the file contains password hashes) |
   | Custom Environment Variable Prefix | **`BLOB`**. It is a *prefix*, not the full name. `BLOB` gives `BLOB_READ_WRITE_TOKEN`, which the app reads. Typing `BLOB_READ_WRITE_TOKEN` would create `BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN` instead, and sync would stay off. |
   | Add a read-write token env var to this connection | **Tick it.** This creates `BLOB_READ_WRITE_TOKEN`. |

   Click **Create**. Vercel adds the variables to Production and Preview.
   Check under *Settings → Environment Variables* that **`BLOB_READ_WRITE_TOKEN`** is listed.
2. **Project → Settings → Environment Variables**, add:
   ```
   SYNC_SECRET=<long random string>      # e.g. run: openssl rand -hex 32
   SHEET_ADMIN_KEY=<a password you choose>
   ```
3. Redeploy. That's it: `CONFIG.SYNC_ENABLED` is `'auto'`, so the app turns sync on as soon as `/api/sheet?status` reports the store is connected. You don't need a code change.
   - The file is created on the first sign-up.
   - Accounts created before sync was on are added the next time they log in.

### Opening the file in Excel

- **Download link:** `https://<your-site>/api/sheet?download&key=<SHEET_ADMIN_KEY>` downloads the current `agrosphere-ai-data.xlsx`.
- Or: **Vercel → Storage → your Blob store → Browser → agrosphere-ai-data.xlsx → Download.**
- Use *Data → Filter* on `userId` or `entryType` to see one farmer's data.

Treat downloaded copies as **read-only snapshots**. The app owns the live file, and the next sync overwrites it, so edits made in Excel and re-uploaded would be lost. The file contains password hashes, so keep downloads private.

### Local testing against the real Blob store

Run `vercel env pull .env.local` (or copy `BLOB_READ_WRITE_TOKEN` and `SYNC_SECRET` into `.env.local`), then `node dev-server.mjs`. It prints which file it is using.

### Limits

- One Excel cell holds at most 32,767 characters. That's why diagnosis photo thumbnails stay on the device.
- Every save re-writes the whole file. That's fine for testing and a few thousand rows; after that, move the same rows into a database (the row format doesn't need to change).

---

## 4. AI through Vercel AI Gateway

### 4.1 Get the key

1. Go to **vercel.com → your team → AI Gateway** (left sidebar). Your free monthly credit is shown on the Overview.
2. Go to **API Keys → Create key**, then copy it.
3. Go to **Project → Settings → Environment Variables** and add `AI_GATEWAY_API_KEY=<key>` for Production, Preview and Development. Redeploy.
4. For local testing, put the same line in `.env.local`.

On Vercel deployments the function can also use Vercel's built-in OIDC token when no key is set. The API key is simpler and also works locally.

### 4.2 How the key stays hidden

The browser never sees the key. The frontend calls **`/api/ai`**, a serverless function in `api/ai.js`. That function adds the key, picks the model and calls `https://ai-gateway.vercel.sh/v1/chat/completions`. Extra protection:

- `ALLOWED_ORIGINS=https://your-site.vercel.app` blocks other websites from calling your endpoint.
- There is a best-effort per-IP hourly cap (`AI_HOURLY_LIMIT_PER_IP`, default 40).
- Inputs are validated and size-limited, including image type and size.

### 4.3 Models (tested with a free-tier key, 27 Sep 2026)

AI Gateway's **free credit only covers some models**. Newer ones (`gemini-3-flash`, `gemini-3.x-flash-lite`, `gpt-6-luna`, Claude, DeepSeek...) return **403 "Free tier users do not have access to this model"** until you buy paid credits. The defaults below all work on the free tier:

| Use | Model | Input / Output per 1M tokens | Why |
|---|---|---|---|
| Chatbot (5/day) | `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | Cheapest; fast, good multilingual chat |
| Plant diagnosis (1/day) | `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | Reads images; JSON output |
| Overview analysis (3/day) | `openai/gpt-5-mini` | $0.25 / $2.00 | Strongest free-tier option in our test; gave the most specific advice, ~15 s |

Other free-tier models that worked: `google/gemini-2.5-flash` (faster, ~10 s, slightly less detailed), `openai/gpt-5`, `openai/gpt-4.1`, `openai/gpt-4.1-mini`, `openai/gpt-5-nano`.

To change a model, set `AI_MODEL_CHAT`, `AI_MODEL_VISION` or `AI_MODEL_ANALYSIS` (in `.env.local` locally, and in Vercel's environment variables). No code change is needed. **Remember the Vercel variables override the code defaults.** If you copied `.env.example` earlier with `gemini-3-flash`, update `AI_MODEL_ANALYSIS` in Vercel too.

The analysis runs with low reasoning effort and a large token allowance. Reasoning models count their thinking toward the limit, and a small limit cut the JSON off. If a model needs paid credits, the Overview now says so instead of showing a vague error.

**Where to put your key:** use `.env.local` (git-ignored), **never `.env.example`**, which is committed to GitHub.

### 4.4 Daily limits (`js/config.js` → `AI_LIMITS`)

| Feature | Limit | Behaviour |
|---|---|---|
| Chatbot | 5 messages/day | Keeps the last 5 messages. On the 5th, the AI also returns a full conversation summary, which is carried forward; older messages are deleted. |
| Overview analysis | 3/day | Runs only when farm data changed since the last analysis **and** the user opens Overview. Returns response, follow-up question, context and a recommendations list, all stored locally (and synced). Replying hands the context to the chatbot (cheaper model). |
| Plant diagnosis | 1/day | Photo, crop and notes go to the AI. A popup shows the diagnosis, the result is saved on the crop and in Weekly Records, and the crop's health is updated. |

Usage is counted **per device and per user**, and a request needs both to be under the limit. So logging into a second account on the same device does **not** unlock more AI. With Excel sync on, the per-user count also follows the user to other devices.
When a limit is reached, the UI says to check back tomorrow; everything else keeps working. Failed AI calls don't use up quota.

---

## 5. Project map

```
home.html, login.html, signup.html, contact.html, onboarding.html, dashboard.html
components/
  brand-logo.js  theme-toggle.js  lang-switcher.js  ai-chatbot.js  loader.js   <- reusable components
  site-nav.js  site-footer.js
  dashboard/dashboard.js                 <- <agro-dashboard> shell, calls one section per menu item
  dashboard/sections/overview|records|crops|livestock|finance|settings.js
  dashboard/record-modal.js  fields.js  item-forms.js  inventory-page.js  diagnosis-popup.js
js/  config  store  auth  sync  ai  weather  export  insights  i18n  theme  catalog  records  ui  demo
api/ai.js  api/sheet.js                 <- Vercel serverless functions (sheet.js = Excel file in Vercel Blob)
dev-server.mjs                           <- local server; writes .data/agrosphere-ai-data.xlsx
assets/css/  site.css + dashboard.css (your original styles) + *-extra.css additions
.original/                               <- untouched copies of the original two files
```

Demo account: `demo@agrosphere.ai` / `demo1234` (or the "Try the demo account" button).
