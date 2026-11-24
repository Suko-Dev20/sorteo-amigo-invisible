-- ============================================================================
-- Base de datos Cloudflare D1 (SQLite) para Amigo Invisible Nocturno
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  event_date TEXT NULL,
  budget REAL NULL,
  currency TEXT NOT NULL DEFAULT '€',
  custom_message TEXT NULL,
  avoid_reciprocal INTEGER NOT NULL DEFAULT 1,
  anti_spoiler INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'drawn', 'sent')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  wishlist TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (draw_id, phone),
  FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_participants_draw ON participants(draw_id);

CREATE TABLE IF NOT EXISTS exclusions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_id INTEGER NOT NULL,
  giver_id INTEGER NOT NULL,
  excluded_receiver_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (draw_id, giver_id, excluded_receiver_id),
  FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE,
  FOREIGN KEY (giver_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (excluded_receiver_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exclusions_draw ON exclusions(draw_id);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draw_id INTEGER NOT NULL,
  giver_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  reveal_token TEXT NOT NULL UNIQUE,
  whatsapp_status TEXT NOT NULL DEFAULT 'pending' CHECK (whatsapp_status IN ('pending', 'sent', 'failed')),
  sent_at TEXT NULL,
  revealed_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (draw_id, giver_id),
  UNIQUE (draw_id, receiver_id),
  FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE,
  FOREIGN KEY (giver_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignments_draw ON assignments(draw_id);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'simulated')),
  message_preview TEXT NULL,
  detail TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_logs_assignment ON notification_logs(assignment_id);
