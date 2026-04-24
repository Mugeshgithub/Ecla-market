// Seed sample data for local demos. Run: npm run seed
const { db, DEFAULT_CAMPUS_ID } = require('./db');

const demoUsers = [
  { telegram_id: 9000001, first_name: 'Karim',    username: 'karim_demo' },
  { telegram_id: 9000002, first_name: 'Ana',      username: 'ana_demo' },
  { telegram_id: 9000003, first_name: 'Sofia',    username: 'sofia_demo' },
  { telegram_id: 9000004, first_name: 'Youcef',   username: 'youcef_demo' },
  { telegram_id: 9000005, first_name: 'Priya',    username: 'priya_demo' },
  { telegram_id: 9000006, first_name: 'Fatima',   username: 'fatima_demo' },
  { telegram_id: 9000007, first_name: 'Camille',  username: 'camille_demo' },
  { telegram_id: 9000008, first_name: 'Maria',    username: 'maria_demo' },
  { telegram_id: 9000009, first_name: 'Mohammed', username: 'mohammed_demo' },
  { telegram_id: 9000010, first_name: 'Anna',     username: 'anna_demo' },
];

const upsertUser = db.prepare(`
  insert into users (telegram_id, first_name, username, campus_id)
  values (?, ?, ?, ?)
  on conflict(telegram_id) do nothing
`);
demoUsers.forEach(u => upsertUser.run(u.telegram_id, u.first_name, u.username, DEFAULT_CAMPUS_ID));

const listingExists = db.prepare(`select count(*) as c from listings`).get().c > 0;
if (!listingExists) {
  const ins = db.prepare(`
    insert into listings (campus_id, seller_id, category, title, price, condition, description)
    values (?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [9000001, 'Electronics', 'iPhone 11 Pro 256GB',   150, 'Like new', 'No scratches, comes with charger and box. Battery 89%.'],
    [9000002, 'Furniture',   'Black Leather Sofa Bed', 70, 'Good',     '167cm, converts to bed. Moving out — must go!'],
    [9000003, 'Clothes',     'Zara Jacket — Size S',   20, 'Like new', 'Worn once. Beige colour, true to size.'],
    [9000004, 'Electronics', 'Monitor 23" Full HD',    30, 'Good',     'Works perfectly. Building B pickup.'],
    [9000005, 'Books',       'Agatha Christie x5',      8, 'Used',     '5 English novels. Happy to exchange too!'],
  ].forEach(r => ins.run(DEFAULT_CAMPUS_ID, ...r));
}

const foodExists = db.prepare(`select count(*) as c from foods`).get().c > 0;
if (!foodExists) {
  const ins = db.prepare(`
    insert into foods (campus_id, seller_id, name, price, tag, description)
    values (?, ?, ?, ?, ?, ?)
  `);
  [
    [9000005, 'Chicken Biryani',    6.99, 'Homemade', 'Generous portion, delivered ~9:30PM. Order before 8PM.'],
    [9000006, 'Moroccan Tajine',    10,   'Homemade', 'Chicken or fish. Order before 11AM, delivered 2hrs later.'],
    [9000005, 'Dal Tadka Rice',     5.50, 'Vegan',    'Fresh vegetarian. Delivered evenings.'],
    [9000007, 'Crêpes x3',          3,    'Dessert',  'Sweet or savoury, made to order.'],
    [9000008, 'Banana Bread Slice', 2.50, 'Dessert',  'Freshly baked. DM to order.'],
  ].forEach(r => ins.run(DEFAULT_CAMPUS_ID, ...r));
}

const lostExists = db.prepare(`select count(*) as c from lost_items`).get().c > 0;
if (!lostExists) {
  const ins = db.prepare(`
    insert into lost_items (campus_id, poster_id, type, description)
    values (?, ?, ?, ?)
  `);
  [
    [9000009, 'lost',  'iPhone Lightning charger left at gym yesterday evening'],
    [9000010, 'found', 'White room access card found near elevator, Building A'],
    [9000001, 'lost',  'AirPod right ear — lost in common areas'],
  ].forEach(r => ins.run(DEFAULT_CAMPUS_ID, ...r));
}

const annExists = db.prepare(`select count(*) as c from announcements`).get().c > 0;
if (!annExists) {
  const ins = db.prepare(`insert into announcements (campus_id, tag, text, author) values (?, ?, ?, ?)`);
  ins.run(DEFAULT_CAMPUS_ID, 'Reception', 'Hot water maintenance Saturday 10AM–2PM. Plan ahead!', 'ECLA Management');
  ins.run(DEFAULT_CAMPUS_ID, 'Community', 'Rooftop BBQ this Friday — bring something to share 🍖', 'Residents');
}

console.log('✅ Seed complete.');
