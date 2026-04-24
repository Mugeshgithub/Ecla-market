const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'ecla.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Ensure default campus (Noisy-le-Grand) exists — single-campus v1.
db.prepare(`
  insert into campuses (slug, name, city)
  values ('noisy', 'ECLA Noisy-le-Grand', 'Noisy-le-Grand')
  on conflict(slug) do nothing
`).run();

const DEFAULT_CAMPUS_ID = db.prepare(`select id from campuses where slug = 'noisy'`).get().id;

module.exports = { db, DEFAULT_CAMPUS_ID };
