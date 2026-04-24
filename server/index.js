require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const { db, DEFAULT_CAMPUS_ID } = require('./db');
const { verifyInitData } = require('./auth');

const {
  BOT_TOKEN,
  MINI_APP_URL = 'https://mugeshgithub.github.io/Ecla-market/',
  GROUP_CHAT_ID,           // Telegram chat id of the residents' group (optional)
  ADMIN_TELEGRAM_IDS = '', // comma-separated
  PORT = 3000,
  PUBLIC_URL,              // https://<render-service>.onrender.com (needed for webhook)
  ALLOW_DEV_AUTH,          // if '1', accept x-telegram-user-id header (LOCAL DEV ONLY)
} = process.env;

if (!BOT_TOKEN) {
  console.warn('[warn] BOT_TOKEN missing — bot features disabled');
}

const adminIds = new Set(
  ADMIN_TELEGRAM_IDS.split(',').map(s => s.trim()).filter(Boolean).map(Number)
);

// ───────────────────────────────────────────────────────────
// Bot
// ───────────────────────────────────────────────────────────
const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

if (bot) {
  bot.start(ctx =>
    ctx.reply(
      `👋 Welcome to ECLA Market!\n\nBuy, sell, and share with your residence.`,
      Markup.inlineKeyboard([Markup.button.webApp('🛒 Open ECLA Market', MINI_APP_URL)])
    )
  );

  bot.command('announce', async ctx => {
    if (!adminIds.has(ctx.from.id)) return ctx.reply('⛔ Admin only.');
    const text = ctx.message.text.replace(/^\/announce(@\w+)?\s*/, '').trim();
    if (!text) return ctx.reply('Usage: /announce <message>');
    db.prepare(
      `insert into announcements (campus_id, tag, text, author) values (?, 'Reception', ?, ?)`
    ).run(DEFAULT_CAMPUS_ID, text, ctx.from.first_name || 'Admin');
    ctx.reply('✅ Announcement posted.');
    if (GROUP_CHAT_ID) bot.telegram.sendMessage(GROUP_CHAT_ID, `📢 ${text}`).catch(() => {});
  });

  bot.command('id', ctx => ctx.reply(`chat_id: ${ctx.chat.id}\nyour user_id: ${ctx.from.id}`));
}

async function notifyGroup(text) {
  if (!bot || !GROUP_CHAT_ID) return;
  try {
    await bot.telegram.sendMessage(GROUP_CHAT_ID, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  } catch (e) {
    console.error('[notifyGroup]', e.message);
  }
}

async function dmUser(telegramId, text) {
  if (!bot || !telegramId) return;
  try {
    await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('[dmUser]', telegramId, e.message);
  }
}

// ───────────────────────────────────────────────────────────
// Express API
// ───────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '6mb' })); // base64 images can be chunky

// Auth middleware — verifies Telegram initData and upserts the user.
// Mini App sends it as header `x-telegram-init-data` or ?init_data= query.
// For local dev without a real bot, pass ALLOW_DEV_AUTH=1 and header
// `x-telegram-user-id: <id>` plus `x-telegram-first-name: <name>`.
function authRequired(req, res, next) {
  let user = null;

  const initData = req.header('x-telegram-init-data') || req.query.init_data;
  if (initData && BOT_TOKEN) user = verifyInitData(initData, BOT_TOKEN);

  if (!user && ALLOW_DEV_AUTH === '1') {
    const devId = Number(req.header('x-telegram-user-id'));
    if (devId) {
      user = {
        id: devId,
        first_name: req.header('x-telegram-first-name') || `Dev${devId}`,
        username: req.header('x-telegram-username') || null,
      };
    }
  }

  if (!user) return res.status(401).json({ error: 'unauthorized' });

  db.prepare(
    `insert into users (telegram_id, first_name, last_name, username, photo_url, campus_id, is_admin)
     values (?, ?, ?, ?, ?, ?, ?)
     on conflict(telegram_id) do update set
       first_name = excluded.first_name,
       last_name  = excluded.last_name,
       username   = excluded.username,
       photo_url  = coalesce(excluded.photo_url, users.photo_url),
       last_seen  = datetime('now')`
  ).run(
    user.id,
    user.first_name || null,
    user.last_name || null,
    user.username || null,
    user.photo_url || null,
    DEFAULT_CAMPUS_ID,
    adminIds.has(user.id) ? 1 : 0
  );

  req.user = user;
  req.campusId = DEFAULT_CAMPUS_ID;
  next();
}

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

// Public feed endpoints (no auth — marketplace is readable by design).
// They still scope by campus.
app.get('/api/listings', (req, res) => {
  const rows = db.prepare(`
    select l.*, u.first_name as seller_name, u.username as seller_username
    from listings l
    join users u on u.telegram_id = l.seller_id
    where l.campus_id = ?
    order by l.created_at desc
    limit 200
  `).all(DEFAULT_CAMPUS_ID);
  res.json(rows);
});

app.get('/api/foods', (_req, res) => {
  const rows = db.prepare(`
    select f.*, u.first_name as seller_name, u.username as seller_username
    from foods f
    join users u on u.telegram_id = f.seller_id
    where f.campus_id = ? and f.available = 1
    order by f.created_at desc
    limit 200
  `).all(DEFAULT_CAMPUS_ID);
  res.json(rows);
});

app.get('/api/lost', (_req, res) => {
  const rows = db.prepare(`
    select l.*, u.first_name as poster_name, u.username as poster_username
    from lost_items l
    join users u on u.telegram_id = l.poster_id
    where l.campus_id = ? and l.resolved = 0
    order by l.created_at desc
    limit 200
  `).all(DEFAULT_CAMPUS_ID);
  res.json(rows);
});

app.get('/api/announcements', (_req, res) => {
  const rows = db.prepare(`
    select * from announcements
    where campus_id = ?
    order by created_at desc
    limit 20
  `).all(DEFAULT_CAMPUS_ID);
  res.json(rows);
});

// Profile — authed user's data.
app.get('/api/me', authRequired, (req, res) => {
  const u = db.prepare(`select * from users where telegram_id = ?`).get(req.user.id);
  const listed = db.prepare(`select count(*) as c from listings where seller_id = ? and sold = 0`).get(req.user.id).c;
  const sold   = db.prepare(`select count(*) as c from listings where seller_id = ? and sold = 1`).get(req.user.id).c;
  const orders = db.prepare(`select count(*) as c from orders where buyer_id = ?`).get(req.user.id).c;
  res.json({ ...u, listed, sold, orders });
});

// Create listing
app.post('/api/listings', authRequired, async (req, res) => {
  const { category, title, price, condition, description, image_url } = req.body || {};
  if (!category || !title || price == null || !condition) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const info = db.prepare(`
    insert into listings (campus_id, seller_id, category, title, price, condition, description, image_url)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.campusId, req.user.id, category, title, Number(price), condition, description || null, image_url || null);

  notifyGroup(`🛒 <b>${escape(title)}</b> — €${Number(price)}\nby ${escape(req.user.first_name || 'Someone')} · ${escape(category)}\n<a href="${MINI_APP_URL}">Open in app</a>`);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Mark listing sold / delete (own only)
app.patch('/api/listings/:id', authRequired, (req, res) => {
  const { sold } = req.body || {};
  const r = db.prepare(`update listings set sold = ? where id = ? and seller_id = ?`)
    .run(sold ? 1 : 0, req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.delete('/api/listings/:id', authRequired, (req, res) => {
  const r = db.prepare(`delete from listings where id = ? and seller_id = ?`).run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// Create food
app.post('/api/foods', authRequired, async (req, res) => {
  const { name, price, tag, description, image_url } = req.body || {};
  if (!name || price == null || !tag) return res.status(400).json({ error: 'missing fields' });
  const info = db.prepare(`
    insert into foods (campus_id, seller_id, name, price, tag, description, image_url)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(req.campusId, req.user.id, name, Number(price), tag, description || null, image_url || null);

  notifyGroup(`🍔 <b>${escape(name)}</b> — €${Number(price)}\nby ${escape(req.user.first_name || 'Someone')} · ${escape(tag)}\n<a href="${MINI_APP_URL}">Order in app</a>`);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Create lost/found
app.post('/api/lost', authRequired, async (req, res) => {
  const { type, description, image_url } = req.body || {};
  if (!['lost', 'found'].includes(type) || !description) return res.status(400).json({ error: 'missing fields' });
  const info = db.prepare(`
    insert into lost_items (campus_id, poster_id, type, description, image_url)
    values (?, ?, ?, ?, ?)
  `).run(req.campusId, req.user.id, type, description, image_url || null);

  const emoji = type === 'lost' ? '😢' : '✅';
  notifyGroup(`${emoji} <b>${type.toUpperCase()}</b> — ${escape(description)}\nby ${escape(req.user.first_name || 'Someone')}\n<a href="${MINI_APP_URL}">Open in app</a>`);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Place food order → notify seller
app.post('/api/orders', authRequired, async (req, res) => {
  const { food_id, note } = req.body || {};
  const food = db.prepare(`select f.*, u.first_name as seller_name from foods f join users u on u.telegram_id = f.seller_id where f.id = ?`).get(food_id);
  if (!food) return res.status(404).json({ error: 'food not found' });

  const info = db.prepare(`insert into orders (food_id, buyer_id, note) values (?, ?, ?)`)
    .run(food_id, req.user.id, note || null);

  dmUser(
    food.seller_id,
    `🛒 New order!\n<b>${escape(food.name)}</b> — €${food.price}\nfrom <b>${escape(req.user.first_name || 'a resident')}</b>` +
      (req.user.username ? ` (@${escape(req.user.username)})` : '') +
      (note ? `\n\nNote: ${escape(note)}` : '')
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Contact seller — returns a DM link when possible.
app.get('/api/listings/:id/contact', authRequired, (req, res) => {
  const l = db.prepare(`
    select l.*, u.first_name as seller_name, u.username as seller_username
    from listings l join users u on u.telegram_id = l.seller_id where l.id = ?
  `).get(req.params.id);
  if (!l) return res.status(404).json({ error: 'not found' });

  // Tell the seller that a buyer is interested (best-effort DM).
  dmUser(
    l.seller_id,
    `💬 <b>${escape(req.user.first_name || 'Someone')}</b>` +
      (req.user.username ? ` (@${escape(req.user.username)})` : '') +
      ` is interested in your listing <b>${escape(l.title)}</b> (€${l.price}).`
  );

  const dm = l.seller_username ? `https://t.me/${l.seller_username}` : null;
  res.json({ telegram_url: dm, seller_name: l.seller_name });
});

// Admin: post an announcement.
app.post('/api/announcements', authRequired, (req, res) => {
  if (!adminIds.has(req.user.id)) return res.status(403).json({ error: 'admin only' });
  const { tag = 'Reception', text, author } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const info = db.prepare(`insert into announcements (campus_id, tag, text, author) values (?, ?, ?, ?)`)
    .run(req.campusId, tag, text, author || req.user.first_name || 'Admin');
  notifyGroup(`📢 <b>${escape(tag)}</b>\n${escape(text)}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ───────────────────────────────────────────────────────────
// HTML escape for Telegram messages (Telegram uses a narrow HTML subset)
// ───────────────────────────────────────────────────────────
function escape(s) {
  return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// ───────────────────────────────────────────────────────────
// Boot — webhook in prod, long-polling locally.
// ───────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});

if (bot) {
  if (PUBLIC_URL) {
    const secretPath = `/tg/${BOT_TOKEN.split(':')[1].slice(0, 16)}`;
    app.use(bot.webhookCallback(secretPath));
    bot.telegram.setWebhook(`${PUBLIC_URL}${secretPath}`).then(() => {
      console.log(`[bot] webhook set → ${PUBLIC_URL}${secretPath}`);
    }).catch(e => console.error('[bot] setWebhook failed', e.message));
  } else {
    console.log('[bot] starting long-polling (local dev)…');
    bot.launch()
      .then(() => console.log('[bot] long-polling stopped'))
      .catch(e => console.error('[bot] launch error:', e.message));
    // Give Telegraf a beat to establish the polling connection, then log.
    bot.telegram.getMe()
      .then(me => console.log(`[bot] connected as @${me.username} (${me.first_name})`))
      .catch(e => console.error('[bot] getMe failed:', e.message));
    process.once('SIGINT',  () => { bot.stop('SIGINT');  server.close(); });
    process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
  }
}
