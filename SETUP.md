# ECLA Market — Setup

Runs a Node/Express API + Telegraf bot in one process, backed by SQLite. Frontend stays on GitHub Pages.

```
Ecla-market/
├── index.html          ← Mini App (GitHub Pages)
├── admin/index.html    ← Admin panel for announcements
└── server/             ← API + bot (deploy to Render)
    ├── index.js
    ├── db.js
    ├── auth.js
    ├── schema.sql
    ├── seed.js
    └── render.yaml
```

---

## 1 · Create the Telegram bot

1. Open [@BotFather](https://t.me/BotFather) → `/newbot` → follow prompts.
2. Copy the **bot token**. You'll put it in `.env` next — never commit it.
3. `/newapp` on BotFather to register the Mini App:
   - Bot: your new bot.
   - Title: `ECLA Market`.
   - URL: `https://mugeshgithub.github.io/Ecla-market/`
4. `/setmenubutton` → paste the same URL so users see the launch button in chat.

## 2 · Run the server locally

```bash
cd server
cp .env.example .env
# edit .env → paste BOT_TOKEN. Leave PUBLIC_URL empty for local dev.
npm install
npm run seed        # optional — loads demo rows
npm run dev         # starts API + bot (long-polling)
```

Server listens on `http://localhost:3000`. The bot starts in long-polling mode — DM it `/start` to test.

**Test the API without Telegram** (dev auth is on via `ALLOW_DEV_AUTH=1`):

```bash
curl http://localhost:3000/api/listings
curl -X POST http://localhost:3000/api/listings \
  -H 'content-type: application/json' \
  -H 'x-telegram-user-id: 123' \
  -H 'x-telegram-first-name: Mugesh' \
  -d '{"category":"Books","title":"Test","price":5,"condition":"Used"}'
```

## 3 · Point the Mini App at your server

The frontend picks the API URL in this order:

1. `localStorage.ecla_api` (manual override — open DevTools: `localStorage.ecla_api='http://localhost:3000'`)
2. `localhost` → `http://localhost:3000`
3. otherwise → `https://ecla-market.onrender.com` (edit this in `index.html` after you deploy)

To test locally, serve `index.html` over a local server (Telegram WebApp won't run from `file://`):

```bash
cd /Users/mugesh/Ecla-market
python3 -m http.server 8080
# open http://localhost:8080 in a browser tab for a non-Telegram preview
```

## 4 · Deploy the server to Render

1. Push the repo to GitHub (`server/` is included; the DB file is gitignored).
2. On Render → **New Web Service** → pick the repo → Render reads `server/render.yaml`.
3. Paste env vars in the Render dashboard:
   - `BOT_TOKEN` — from BotFather
   - `PUBLIC_URL` — the URL Render assigns (e.g. `https://ecla-market.onrender.com`). The bot switches to webhook mode when this is set.
   - `GROUP_CHAT_ID` — optional; fill after step 5.
   - `ADMIN_TELEGRAM_IDS` — your own Telegram user id (DM [@userinfobot](https://t.me/userinfobot) to get it).
4. After first deploy, open the service URL + `/health` — should return `{"ok":true}`.
5. In `index.html`, update the fallback URL to your Render URL (line with `ecla-market.onrender.com`). Commit + push — GitHub Pages redeploys automatically.

## 5 · Wire up the residents' group

1. Add your bot to the ECLA residents' Telegram group.
2. Send `/id` in the group → the bot replies with the chat id (a negative number like `-1001234567890`).
3. Put that in `GROUP_CHAT_ID` on Render → redeploy.
4. Every new listing/food/lost-item post from the Mini App will now be announced in the group with a link back into the app.

## 6 · Admin panel

Hosted at `admin/index.html`. Two ways to use it:

- Deploy it to the same GitHub Pages site and register it as a separate Mini App via `/newapp` on BotFather (e.g. title `ECLA Admin`). Open from BotFather.
- Or use bot commands: DM the bot `/announce Hot water off Saturday` (admin users only).

Either way, only Telegram IDs listed in `ADMIN_TELEGRAM_IDS` can post.

---

## What's wired up after Phase 1

- [x] Persistent storage (SQLite) — listings, food, lost & found, announcements, orders, users
- [x] Telegram bot — `/start`, `/announce`, `/id`
- [x] Mini App → API (listings, food, lost, announcements all persist)
- [x] Group notification on every new post
- [x] Contact seller → DMs the seller through the bot + opens their Telegram if username is public
- [x] Food order → DMs the seller automatically
- [x] Admin panel for announcements
- [x] `initData` HMAC verification (Telegram user identity is real, not trusted from the client)
- [x] Multi-campus schema (single default campus for now; adding more = insert a row)

## Phase 2 ideas (ask when ready)

- Image uploads to a proper object store (currently base64 data URLs — fine for demo, heavy at scale)
- Seller ratings / report button
- Push a weekly "digest" to the group
- Campus picker in the Mini App (once a second location is live)
- Analytics to show ECLA management on the pitch call
