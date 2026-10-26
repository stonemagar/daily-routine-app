PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,subscription_json TEXT NOT NULL,data_json TEXT NOT NULL,updated_at INTEGER NOT NULL,last_test_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS deliveries(device_id TEXT NOT NULL,event_key TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(device_id,event_key),FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE);
