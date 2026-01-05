const Database = require("better-sqlite3");
const db = new Database("warehouse.db");

// таблиці користувачів (якщо ще немає)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS metals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS daily_prices (
  metal_id INTEGER,
  price INTEGER,
  date TEXT,
  PRIMARY KEY (metal_id, date)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  created_at TEXT,
  total INTEGER
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  metal_id INTEGER,
  weight REAL,
  price INTEGER,
  sum INTEGER
);
`);

module.exports = db;
