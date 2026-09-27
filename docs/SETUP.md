# Agrosphere AI - Setup Guide

## 1. Run it locally

```bash
cd ai-web
cp .env.example .env.local     # fill in values later; the app works without them
node dev-server.mjs            # http://localhost:3000  (redirects to /home)
```

`dev-server.mjs` has no dependencies. It serves clean URLs (`/home`, `/login`, `/dashboard`...) and runs the `/api` functions with your `.env.local`.
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

## 3. Excel spreadsheet (one file, one table, every row tied to a user)

The app stays **local-first**. It always reads from and writes to `localStorage` instantly. Changed rows are pushed to Excel in the background, 4 seconds after the last change and whenever the tab is hidden.
When a user logs in on another device, `/api/sheet` returns all rows for that `userId`. They are merged into that device's `localStorage`, and the app carries on as normal.
Excel is slow (each Graph call takes 0.5-2 s), which is why the UI never waits for it.

### 3.1 Create the workbook

1. In OneDrive (or SharePoint), create **`agrosphere-ai-data.xlsx`**.
2. Rename the first sheet to **`Entries`**.
3. Type these headers in **A1:G1** exactly:

   | A | B | C | D | E | F | G |
   |---|---|---|---|---|---|---|
   | id | userId | entryType | data | createdAt | updatedAt | deleted |

4. Select **A1:G2** → *Insert → Table* → tick *My table has headers*.
5. Open *Table Design* and set **Table Name** to `Entries`. The table must start at **A1**.
6. Select column D and set *Format → Text* (it holds JSON).

Example row the app writes:

| id | userId | entryType | data | createdAt | updatedAt | deleted |
|---|---|---|---|---|---|---|
| cro_m1x...| usr_m1a... | crop | `{"name":"Maize","variety":"Oba Super 2","health":"good",...}` | 2026-09-27T10:00:00Z | 2026-09-27T10:05:00Z | FALSE |

Deletes are soft (`deleted = TRUE`), so row positions never shift. Filter by `userId` in Excel to see one farmer's data.

### 3.2 Register an app with Microsoft (free)

1. Go to **entra.microsoft.com → App registrations → New registration**.
2. Name it `Agrosphere Sync`. Pick the supported account type:
   - **Personal Microsoft account (outlook.com / hotmail):** "Personal Microsoft accounts only".
   - **Work/school Microsoft 365:** "Accounts in this organizational directory only".
3. Copy the **Application (client) ID** → `MS_CLIENT_ID`.

**Personal OneDrive:**

4. Go to *Authentication → Allow public client flows → Yes*, then Save.
5. Run: `MS_CLIENT_ID=<id> node scripts/get-ms-refresh-token.mjs`
6. Sign in with the code it prints.
7. Copy the printed `MS_REFRESH_TOKEN` and your workbook URL.
8. Set `MS_TENANT_ID=consumers` and leave `MS_CLIENT_SECRET` empty.
9. If sync later fails with `invalid_grant` (roughly every 90 days), run the script again.

**Work/school Microsoft 365:**

4. Go to *API permissions → Add → Microsoft Graph → Application permissions → `Files.ReadWrite.All`*, then *Grant admin consent*.
5. Go to *Certificates & secrets → New client secret* → `MS_CLIENT_SECRET`.
6. Set `MS_TENANT_ID` to your *Directory (tenant) ID*, and leave `MS_REFRESH_TOKEN` empty.
7. Set the workbook URL to `https://graph.microsoft.com/v1.0/users/<your-email>/drive/root:/agrosphere-ai-data.xlsx:/workbook`.

### 3.3 Environment variables (Vercel → Project → Settings → Environment Variables)

```
SYNC_SECRET=<any long random string>          # e.g. openssl rand -hex 32
MS_TENANT_ID=consumers
MS_CLIENT_ID=...
MS_CLIENT_SECRET=                              # work/school only
MS_REFRESH_TOKEN=...                           # personal only
EXCEL_WORKBOOK_URL=https://graph.microsoft.com/v1.0/me/drive/items/<ITEM-ID>/workbook
EXCEL_TABLE=Entries
EXCEL_SHEET=Entries
```

### 3.4 Switch it on

In `js/config.js` set `SYNC_ENABLED: true` and redeploy. From then on:

- **Sign up** checks Excel for duplicate emails and writes the `user` row.
- **Log in** checks the password against the Excel `user` row and pulls all of that user's rows.
- **Every change** is queued, then pushed in the background. The newest `updatedAt` wins.

Limits to know: one Excel cell holds at most 32,767 characters (diagnosis photo thumbnails are therefore kept on the device and not synced). Excel is fine for testing and a few thousand rows; after that, move the same rows to a database.

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

### 4.3 Models (live AI Gateway prices, per 1M tokens, checked 27 Sep 2026)

| Use | Model | Input | Output | Why |
|---|---|---|---|---|
| Chatbot (5/day) | `google/gemini-2.5-flash-lite` | $0.10 | $0.40 | Cheapest proven model with good multilingual chat |
| Plant diagnosis (1/day) | `google/gemini-2.5-flash-lite` | $0.10 | $0.40 | Same cheap model; reads images; JSON output |
| Overview analysis (3/day) | `google/gemini-3-flash` | $0.50 | $3.00 | Noticeably stronger reasoning over the full farm bundle, still cheap |

Rough cost per active user per day at the limits: well under **$0.01**.
To try other models, change `AI_MODEL_CHAT`, `AI_MODEL_VISION` or `AI_MODEL_ANALYSIS`; no code change is needed. `google/gemini-3.1-flash-lite` ($0.25/$1.50) is a good step up for diagnosis if the cheap model's accuracy isn't enough.

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
api/ai.js  api/sheet.js                 <- Vercel serverless functions
assets/css/  site.css + dashboard.css (your original styles) + *-extra.css additions
.original/                               <- untouched copies of the original two files
```

Demo account: `demo@agrosphere.ai` / `demo1234` (or the "Try the demo account" button).
