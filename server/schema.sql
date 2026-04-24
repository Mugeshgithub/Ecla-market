-- ECLA Market — SQLite schema
-- Applied automatically on first boot by db.js.

pragma journal_mode = wal;
pragma foreign_keys = on;

create table if not exists campuses (
  id         integer primary key autoincrement,
  slug       text unique not null,
  name       text not null,
  city       text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists users (
  telegram_id integer primary key,
  first_name  text,
  last_name   text,
  username    text,
  photo_url   text,
  campus_id   integer references campuses(id),
  is_admin    integer not null default 0,
  created_at  text not null default (datetime('now')),
  last_seen   text not null default (datetime('now'))
);

create table if not exists listings (
  id          integer primary key autoincrement,
  campus_id   integer not null references campuses(id),
  seller_id   integer not null references users(telegram_id) on delete cascade,
  category    text not null check (category in ('Electronics','Clothes','Furniture','Services','Books','Other')),
  title       text not null,
  price       real    not null check (price >= 0),
  condition   text    not null check (condition in ('New','Like new','Good','Used')),
  description text,
  image_url   text,
  sold        integer not null default 0,
  created_at  text    not null default (datetime('now'))
);
create index if not exists listings_campus_created_idx on listings (campus_id, created_at desc);

create table if not exists foods (
  id          integer primary key autoincrement,
  campus_id   integer not null references campuses(id),
  seller_id   integer not null references users(telegram_id) on delete cascade,
  name        text not null,
  price       real not null check (price >= 0),
  tag         text not null check (tag in ('Homemade','Dessert','Vegan','Healthy')),
  description text,
  image_url   text,
  available   integer not null default 1,
  created_at  text not null default (datetime('now'))
);
create index if not exists foods_campus_created_idx on foods (campus_id, created_at desc);

create table if not exists lost_items (
  id          integer primary key autoincrement,
  campus_id   integer not null references campuses(id),
  poster_id   integer not null references users(telegram_id) on delete cascade,
  type        text    not null check (type in ('lost','found')),
  description text    not null,
  image_url   text,
  resolved    integer not null default 0,
  created_at  text    not null default (datetime('now'))
);
create index if not exists lost_items_campus_created_idx on lost_items (campus_id, created_at desc);

create table if not exists announcements (
  id         integer primary key autoincrement,
  campus_id  integer not null references campuses(id),
  tag        text    not null,
  text       text    not null,
  author     text    not null,
  created_at text    not null default (datetime('now'))
);
create index if not exists announcements_campus_created_idx on announcements (campus_id, created_at desc);

create table if not exists orders (
  id         integer primary key autoincrement,
  food_id    integer not null references foods(id) on delete cascade,
  buyer_id   integer not null references users(telegram_id),
  status     text    not null default 'pending' check (status in ('pending','accepted','delivered','cancelled')),
  note       text,
  created_at text    not null default (datetime('now'))
);
create index if not exists orders_food_idx  on orders (food_id);
create index if not exists orders_buyer_idx on orders (buyer_id);
