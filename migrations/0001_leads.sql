-- Leads left in the Freight Forwarding calculator (Cloudflare deployment).
CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 email TEXT NOT NULL,
 company TEXT NOT NULL,
 record TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
