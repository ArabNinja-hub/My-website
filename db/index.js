const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'studycore.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','STUDENT')) DEFAULT 'STUDENT',
  school TEXT,
  grade TEXT,
  learning_level TEXT DEFAULT 'secondary',
  subscription TEXT NOT NULL DEFAULT 'trial',
  trial_end TEXT,
  subscription_start TEXT,
  subscription_end TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subject TEXT,
  course TEXT,
  year_level TEXT,
  semester TEXT,
  tags TEXT,
  file_name TEXT,
  stored_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  content_hash TEXT,
  external_url TEXT,
  quiz_data TEXT,
  due_date TEXT,
  publish_status TEXT NOT NULL DEFAULT 'published',
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, resource_id)
);

CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT,
  phone TEXT,
  amount REAL,
  status TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_publish ON resources(publish_status);
CREATE INDEX IF NOT EXISTS idx_downloads_resource ON downloads(resource_id);
`);

// Lightweight migration: if this is an existing database created before
// content_hash existed, add the column. Safe to run every boot.
try {
  db.exec('ALTER TABLE resources ADD COLUMN content_hash TEXT');
} catch {
  // column already exists - fine
}

function seedAdmin() {
  const existingAdmin = db.prepare(`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`).get();
  if (existingAdmin) return;

  const email = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : null;
  const password = process.env.ADMIN_PASSWORD || null;
  const name = process.env.ADMIN_NAME || 'Admin';

  // No hardcoded fallback credentials. If ADMIN_EMAIL / ADMIN_PASSWORD are not
  // set, no admin account is created - the operator must set them in .env
  // (see .env.example) or run `npm run make-admin -- someone@example.com`.
  if (!email || !password) {
    console.log('='.repeat(60));
    console.log('StudyCore: no admin account exists yet.');
    console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart,');
    console.log('or run: npm run make-admin -- someone@example.com "Full Name"');
    console.log('='.repeat(60));
    return;
  }

  const hashed = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, name, email, password, role, subscription, subscription_start, subscription_end, created_at)
    VALUES (@id, @name, @email, @password, 'ADMIN', 'premium', @now, @far, @now)
  `).run({
    id: `admin-${Date.now()}`,
    name,
    email,
    password: hashed,
    now,
    far: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString()
  });

  console.log('='.repeat(60));
  console.log(`StudyCore: seeded admin account -> ${email}`);
  console.log('Log in and change this password immediately.');
  console.log('='.repeat(60));
}

seedAdmin();

module.exports = db;
