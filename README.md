# ECLA Market

Private Telegram Mini App marketplace for residents of ECLA student residences in France.

**Live Mini App:** https://mugeshgithub.github.io/Ecla-market/

## What it does

- **Market** — buy/sell items within the residence (categories, search, photos)
- **Food** — homemade food ordering with automatic DM to the seller
- **Lost & Found** — quick reports, notified to the group
- **Announcements** — ECLA management posts, visible on Home
- **Profile** — your listings, sold count, orders placed

## Tech

- Mini App: vanilla HTML/CSS/JS, one file — `index.html`, hosted on GitHub Pages
- API + bot: Node.js + Express + Telegraf + SQLite, one process — `server/`
- Admin: `admin/index.html`

## Setup

See [SETUP.md](./SETUP.md) — step-by-step guide from BotFather to a deployed server.

## Roadmap

Phase 1 (done): persistence, bot, group notifications, contact seller, food orders, admin panel.
Phase 2 (next): object-store image uploads, ratings, analytics dashboard for the ECLA pitch.
Phase 3: multi-campus rollout (Noisy-le-Grand → Massy, Villejuif, Bordeaux, Archamps, Lille).
